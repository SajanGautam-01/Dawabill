"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/billing/InvoiceTemplate";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/Card";
import { 
  Plus, FileText, Loader2, IndianRupee, QrCode, Printer, WifiOff, CloudUpload, AlertTriangle, Tag, Award, Search
} from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { Toast } from "@/components/ui/Toast";
import ProductSearch, { Product } from "@/components/billing/ProductSearch";
import CartTable, { BillItem } from "@/components/billing/CartTable";
import { saveOfflineBill, getAllOfflineBills, deleteOfflineBill } from "@/lib/idb";

type PaymentAccount = {
  id: string;
  upi_id: string;
  display_name: string;
  is_default: boolean;
};

export default function BillingPage() {
  const { storeId, loading: storeLoading } = useStore();
  
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [selectedUpi, setSelectedUpi] = useState<string>("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentInfo, setPendingPaymentInfo] = useState<any>(null); // For Retry Verification Safety
  const [successBillData, setSuccessBillData] = useState<any>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string>("");

  // Phase 2: Advanced Features
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: successBillData ? `Invoice_${successBillData.billNumber}` : 'Invoice'
  });

  const defaultGstRate = 0.12; // 12% default GST for simple build (Rule 1)
  
  useEffect(() => {
    // Check for offline bills in IndexedDB on load and setup manual sync fallback
    const initOffline = async () => {
       const bills = await getAllOfflineBills();
       if (bills && bills.length > 0) setOfflineQueue(bills);
    };
    initOffline();

    // Fallback sync trigger for iOS/Safari when network returns
    const handleOnline = () => {
      syncOfflineBills();
    };
    window.addEventListener('online', handleOnline);

    if (storeId) {
      // Fetch Store details for PDF template
      supabase.from('stores').select('id, store_name, address, phone, gst_number, dl_number, invoice_prefix, default_gst, invoice_logo, print_format, theme_color').eq('id', storeId).single()
        .then(({ data }) => setStoreData(data));
        
      // Fetch UPI configurations
      supabase.from('payment_accounts').select('id, upi_id, is_active, display_name, is_default').eq('store_id', storeId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPaymentAccounts(data);
            const defaultAcc = data.find(d => d.is_default) || data[0];
            setSelectedUpi(defaultAcc.upi_id);
          }
        });

      // Fetch Active Discounts
      supabase.from('discounts').select('*').eq('store_id', storeId).eq('is_active', true)
        .then(({ data }) => { if (data) setAvailableDiscounts(data); });
        
      // Load Razorpay Script dynamically for POS Checkout
      const scriptId = 'razorpay-checkout-js';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.body.appendChild(script);
      }
      
      // Generate initial idempotency key
      setCurrentIdempotencyKey(globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    }
    
    return () => {
      // @ts-ignore
      window.removeEventListener('online', handleOnline);
    };
  }, [storeId]);
  
  const addProductToBill = useCallback((product: Product) => {
    if (product.stock_quantity <= 0) {
      setError(`Cannot add ${product.name}. Out of stock!`);
      return;
    }

    setBillItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          setTimeout(() => setError(`Cannot add more. Only ${product.stock_quantity} in stock.`), 0);
          return prev; 
        }
        
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.sale_rate }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, total: product.sale_rate }];
    });
    setError(null);
  }, []);

  const updateQuantity = useCallback((id: string, qtyStr: string, max: number) => {
    const qty = parseInt(qtyStr) || 1;
    if (qty > max) {
      setError(`Only ${max} items in stock for this product.`);
      return;
    }
    setError(null);
    setBillItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, quantity: qty, total: qty * item.sale_rate }
        : item
    ));
  }, []);

  const removeItem = useCallback((id: string) => {
    setBillItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // Calculations
  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const gstAmount = subtotal * defaultGstRate;
  
  // Calculate Discount
  const selectedDiscount = availableDiscounts.find(d => d.id === selectedDiscountId);
  let discountValue = 0;
  if (selectedDiscount && subtotal >= (selectedDiscount.min_bill_amount || 0)) {
    if (selectedDiscount.discount_type === 'percentage') {
      discountValue = subtotal * (selectedDiscount.value / 100);
    } else {
      discountValue = selectedDiscount.value;
    }
  }

  const grandTotal = subtotal + gstAmount - discountValue;
  const earnedPoints = Math.floor(grandTotal / 100);

  const syncOfflineBills = async () => {
    // Manual fallback / online-trigger for browsers without Background Sync
    if (!navigator.onLine) return;
    
    setIsSyncing(true);
    try {
      const billsToSync = await getAllOfflineBills();
      if (billsToSync.length === 0) return;

      let successCount = 0;
      let failCount = 0;

      for (const bill of billsToSync) {
        try {
          const res = await fetch('/api/sync-offline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bill)
          });
          
          if (!res.ok) throw new Error("API Sync Rejected");
          
          await deleteOfflineBill(bill.idempotency_key);
          successCount++;
        } catch (err) {
          console.error("Manual Sync Failed for bill", bill.bill_number, err);
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setToast({ message: "All offline bills synced successfully!", type: 'success' });
      } else if (failCount > 0) {
         // Silently let it remain in IDB for later
      }
      
      const newDocs = await getAllOfflineBills();
      setOfflineQueue(newDocs);
    } catch (e) {
      console.error("Sync Wrapper Error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    if (!storeId) return setError("Authentication Error");
    if (billItems.length === 0) return setError("Add at least one item to bill.");
    
    for (const item of billItems) {
      if (item.quantity > item.stock_quantity) {
        return setError(`Cannot bill ${item.quantity} units of ${item.name}. Only ${item.stock_quantity} available in stock.`);
      }
    }
    
    if (!navigator.onLine) {
       return setError("Razorpay checkout requires an active internet connection. Please use Cash & Offline Sync.");
    }

    // Script may not be loaded yet (slow network / blocked third-party).
    if (!(window as any).Razorpay) {
      return setError("Payment gateway is still loading. Please wait 2 seconds and try again.");
    }
    
    setIsSaving(true);
    setError(null);

    try {
      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: grandTotal, storeId })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error);
      
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: Math.round(grandTotal * 100),
        currency: "INR",
        name: storeData?.name || "DawaBill Payment",
        description: `Pos Bill for ${billItems.length} items`,
        order_id: orderData.order.id,
        modal: {
          ondismiss: function () {
            setIsSaving(false);
          }
        },
        handler: async function (response: any) {
           setPendingPaymentInfo(response);
           await executeVerifyAndSave(response);
        },
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        setError("Payment failed: " + response.error.description);
        setIsSaving(false);
      });
      rzp.open();
    } catch (err: any) {
      setError("Failed to initialize payment gateway: " + err.message);
      setIsSaving(false);
    }
  };

  const executeVerifyAndSave = async (response: any) => {
    try {
      setIsSaving(true);
      const verifyRes = await fetch('/api/razorpay/bill-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          expectedAmount: grandTotal
        })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error);
      
      if (verifyData.duplicate) {
        setPendingPaymentInfo(null);
        setIsSaving(false);
        setError("Payment recorded previously. Duplicate bill creation prevented securely.");
        startNewBill();
        return;
      }
      
      // Verification Success - Record the paid bill safely
      await saveBillToDB(`razorpay:${response.razorpay_payment_id}`, response.razorpay_order_id);
      setPendingPaymentInfo(null);
    } catch (e: any) {
      setError(`Payment received. Don't worry, your money is safe. Please retry verification. (Error: ${e.message})`);
      setIsSaving(false);
    }
  };

  const saveBillToDB = async (paymentMode: string = 'cash', transactionId: string | null = null) => {
    if (!storeId) return setError("Authentication Error");
    setError(null);
    setIsSaving(true);
    setSuccessBillData(null);


    // PWA Offline Support
    if (!navigator.onLine) {
       const billNumber = `INV-${Date.now().toString().slice(-6)}`;
       const newOfflineBill = {
         store_id: storeId,
         bill_number: billNumber,
         customer_name: customerName,
         customer_phone: customerPhone,
         total_amount: grandTotal,
         gst_amount: gstAmount,
         payment_mode: paymentMode,
         items: billItems,
         discount_id: selectedDiscountId,
         idempotency_key: currentIdempotencyKey,
         external_transaction_id: transactionId,
         sync_status: 'pending',
         retry_count: 0,
         created_at: new Date().toISOString()
       };
       
       // 1. Save to native physical IDB storage robustly
       await saveOfflineBill(newOfflineBill);
       const updatedQueue = await getAllOfflineBills();
       setOfflineQueue(updatedQueue);
       
       // 2. Register native SW Background Sync (Graceful degradation)
       if ('serviceWorker' in navigator && 'SyncManager' in window) {
         try {
           const reg = await navigator.serviceWorker.ready;
           await (reg as any).sync.register('sync-offline-bills');
           console.log("Background Sync Registered successfully");
         } catch (e) {
           console.error("Background sync registration failed natively", e);
         }
       }
       
       setSuccessBillData({
          billNumber,
          amount: grandTotal,
          gstAmount,
          items: billItems,
          qrUrl: null, 
          customerName: customerName || 'Walk-in (Offline)',
          customerPhone: customerPhone || '',
          isOffline: true
       });
       
       setBillItems([]);
       setCustomerName("");
       setCustomerPhone("");
       setIsSaving(false);
       return;
    }

    // 1. CALL ATOMIC RPC (Step 1 Implementation)
    const itemsForRPC = billItems.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      sale_rate: item.sale_rate
    }));

    let rpcResponse: any;
    let rpcError: any;
    try {
      // Phase 4: Create Bill (v5 Hardened with Idempotency & Expiry Check)
      const res = await supabase.rpc('create_bill_v5', {
        p_store_id: storeId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_payment_mode: paymentMode,
        p_items: itemsForRPC,
        p_idempotency_key: currentIdempotencyKey,
        p_external_transaction_id: transactionId,
        p_discount_id: selectedDiscountId
      });
      rpcResponse = res.data;
      rpcError = res.error;
    } catch (e: any) {
      setError(e?.message || "Atomic transaction failed.");
      setIsSaving(false);
      return;
    }

    if (rpcError || !rpcResponse || !rpcResponse.success) {
      const errMsg = rpcError?.message || rpcResponse?.error || "Atomic transaction failed.";
      
      // If it was already processed (Idempotency), we can proceed to success
      if (rpcResponse?.is_duplicate) {
         console.warn("Retrieved existing bill via idempotency_key.");
      } else {
        setError(errMsg);
        // Step 3: Log critical failure
        try {
          await logger.error(`Critical Billing Failure: ${errMsg}`, {
            storeId: storeId || undefined,
            action: 'pos_transaction',
            metadata: { items: itemsForRPC, total: grandTotal, errorDetails: rpcError, key: currentIdempotencyKey }
          });
        } catch (e) {
          console.error("Audit log failed", e);
        }

        setIsSaving(false);
        return;
      }
    }

    const billNumber = rpcResponse.bill_number;
    
    // Step 3: Log success
    try {
      await logger.info(`Invoice ${billNumber} created successfully`, {
        storeId: storeId || undefined,
        action: 'pos_transaction',
        metadata: { billId: rpcResponse.bill_id }
      });
    } catch (e) {
      console.error("Audit log failed", e);
    }

    // Success - Bug Check "QR Wrong Amount": The exact grandTotal is used.
    const upiUri = `upi://pay?pa=${selectedUpi}&pn=DawaBill%20Store&am=${grandTotal.toFixed(2)}&cu=INR`;
    const qrUrl = selectedUpi ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}` : null;

    setSuccessBillData({
      billNumber,
      amount: grandTotal,
      gstAmount,
      items: billItems,
      qrUrl,
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || ''
    });
    
    setBillItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setIsSaving(false);
  };

  const startNewBill = () => {
    setSuccessBillData(null);
    setCurrentIdempotencyKey(globalThis.crypto?.randomUUID?.() ?? String(Date.now())); // Refresh key for new transaction
  };

  if (storeLoading) {
    return <div className="flex h-[50vh] items-center justify-center text-slate-500 animate-pulse">Loading billing environment...</div>;
  }

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">Create Bill</h1>
          <p className="text-base sm:text-lg text-slate-500 mt-2 font-medium">Fast checkout and invoice generation.</p>
        </div>

        {offlineQueue.length > 0 && (
          <div className="bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg flex items-center gap-3 shadow-sm animate-pulse">
            <WifiOff size={18} />
            <span className="font-semibold text-sm">{offlineQueue.length} Bills Pending Sync</span>
            <Button size="sm" onClick={syncOfflineBills} disabled={isSyncing} className="ml-2 bg-amber-600 hover:bg-amber-700 text-white h-8">
              {isSyncing ? <Loader2 className="animate-spin h-4 w-4" /> : <CloudUpload className="h-4 w-4 mr-1" />} Sync Now
            </Button>
          </div>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Customer & Product Search */}
        <div className="lg:col-span-7 space-y-8">
          <Card className="rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 bg-white">
            <CardHeader className="p-6 border-b border-slate-50 bg-slate-50/50 rounded-t-3xl">
              <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800"><FileText size={22} className="text-blue-600"/> Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="font-semibold text-slate-600">Name (Optional)</Label>
                  <Input 
                    id="customerName" 
                    placeholder="John Doe" 
                    className="h-14 rounded-2xl border-2 border-slate-200 bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 focus-visible:bg-white transition-all text-lg font-medium"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    tabIndex={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-semibold text-slate-600">Phone (Optional)</Label>
                  <Input 
                    id="phone" 
                    placeholder="9876543210" 
                    className="h-14 rounded-2xl border-2 border-slate-200 bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 focus-visible:bg-white transition-all text-lg font-medium"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    tabIndex={2}
                    maxLength={10}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200 bg-white overflow-visible relative">
            <CardHeader className="p-6 border-b border-slate-50 bg-slate-50/50 rounded-t-3xl">
              <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800"><Search size={22} className="text-teal-500"/> Search & Add Products</CardTitle>
            </CardHeader>
            <CardContent className="p-6 relative">
              <ProductSearch 
                storeId={storeId!} 
                onAddProduct={addProductToBill} 
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Bill Summary or Success View */}
        <div className="lg:col-span-5">
           <div className="sticky top-24">
          {successBillData ? (
             <Card className="rounded-3xl shadow-2xl border border-emerald-200 bg-white overflow-hidden transform transition-all">
               <div className="h-3 bg-gradient-to-r from-emerald-400 to-teal-500 w-full shadow-inner"></div>
               <CardHeader className="text-center pb-4 pt-8">
                 <div className="w-20 h-20 bg-emerald-100 shadow-inner text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 transform scale-110">
                   <FileText size={40} className="stroke-[2.5]" />
                 </div>
                 <CardTitle className="text-3xl font-black text-emerald-800 tracking-tight">Bill Generated</CardTitle>
                 <CardDescription className="text-emerald-700/70 font-medium mt-2">
                   {successBillData.isOffline ? 'Saved offline. Will sync when connected.' : `Invoice ${successBillData.billNumber} created successfully.`}
                 </CardDescription>
               </CardHeader>
               <CardContent className="flex flex-col items-center pt-2 space-y-6">
                 <div className="text-center bg-slate-50 w-full py-6 rounded-2xl border border-slate-100">
                   <p className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-2">Total Amount Received</p>
                   <p className="text-5xl font-black text-slate-900 flex items-center justify-center"><IndianRupee size={36} className="mr-1 stroke-[3px]"/> {successBillData.amount.toFixed(2)}</p>
                 </div>
                 
                 {successBillData.qrUrl ? (
                   <div className="w-full flex flex-col items-center bg-white border-2 border-dashed border-slate-200 p-6 rounded-3xl">
                     <p className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-wide"><QrCode size={18}/> Scan to Pay</p>
                     <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                       <img src={successBillData.qrUrl} alt="Payment QR Code" width={200} height={200} className="w-48 h-48 rounded-xl" />
                     </div>
                     <p className="text-xs text-slate-500 mt-4 text-center font-medium">Verify UPI mapping via scanner.</p>
                   </div>
                 ) : (
                   <div className="w-full bg-amber-50 text-amber-700 p-4 rounded-2xl text-center text-sm font-medium border border-amber-200">
                     No UPI accounts configured. Add them in Settings.
                   </div>
                 )}
               </CardContent>
               <CardFooter className="bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row gap-3 p-6 rounded-b-3xl">
                 <Button className="w-full sm:w-1/2 h-14 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 text-white transition-all" onClick={handlePrint}>
                   <Printer className="mr-2 h-5 w-5" /> Print Receipt
                 </Button>
                 <Button className="w-full sm:w-1/2 h-14 rounded-2xl text-base font-bold shadow-sm border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all hover:-translate-y-0.5" variant="outline" onClick={startNewBill}>
                   <Plus className="mr-2 h-5 w-5" /> Next Bill
                 </Button>
               </CardFooter>
             </Card>
          ) : (
             <Card className="rounded-3xl shadow-2xl border border-slate-200 bg-white/95 backdrop-blur-3xl transform transition-all">
               <CardHeader className="bg-slate-50/80 border-b border-slate-100 p-6 rounded-t-3xl backdrop-blur-md">
              <CardTitle className="text-xl font-bold flex items-center justify-between text-slate-800">
                <span>Current List</span>
                <span className="bg-blue-100/80 text-blue-800 text-sm px-3.5 py-1.5 rounded-xl font-bold tracking-wide shadow-inner">{billItems.length} items</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 bg-white">
              <CartTable 
                items={billItems}
                isSaving={isSaving}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
              />
            </CardContent>
            
            <CardFooter className="flex-col bg-slate-50/80 border-t border-slate-100 p-6 space-y-6 rounded-b-3xl">
              <div className="w-full space-y-4 text-base">
                {/* Discount Selector */}
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase">
                    <Tag size={14} className="text-blue-500" /> Promo Code
                  </div>
                  <select 
                    className="bg-transparent border-none text-blue-600 font-bold text-sm focus:ring-0 cursor-pointer text-right"
                    value={selectedDiscountId || ""}
                    onChange={(e) => setSelectedDiscountId(e.target.value || null)}
                  >
                    <option value="">No Discount</option>
                    {availableDiscounts.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.discount_type === 'percentage' ? `${d.value}%` : `₹${d.value}`})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-between text-slate-600 font-medium px-1">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium px-1">
                  <span>GST (12%)</span>
                  <span>+ ₹{gstAmount.toFixed(2)}</span>
                </div>
                
                {discountValue > 0 && (
                  <div className="flex justify-between text-green-600 font-bold italic px-1 animate-in slide-in-from-right duration-300">
                    <span className="flex items-center gap-1.5"><Tag size={14} /> Discount Applied</span>
                    <span>- ₹{discountValue.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-xl font-black text-slate-900 border-t-2 border-slate-200/50 pt-4 mt-2 px-1">
                  <span>Grand Total</span>
                  <span className="text-blue-600 flex items-center text-3xl"><IndianRupee size={28} className="mr-0.5 stroke-[3px]"/> {grandTotal.toFixed(2)}</span>
                </div>

                {/* Loyalty Display */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase">
                    <Award size={14} /> Loyalty Points
                  </div>
                  <div className="text-sm font-black text-amber-700">+{earnedPoints} pts</div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {pendingPaymentInfo ? (
                   <Button 
                     className="w-full h-14 rounded-2xl text-base font-bold shadow-lg shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 hover:-translate-y-0.5 text-white transition-all transform" 
                     disabled={isSaving}
                     onClick={() => executeVerifyAndSave(pendingPaymentInfo)}
                     tabIndex={6}
                   >
                     {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                     Retry Verification Sync
                   </Button>
                ) : (
                  <>
                    <Button 
                      className="w-full sm:w-1/2 h-14 rounded-2xl text-base font-bold shadow-sm border-2 border-slate-200 bg-white hover:bg-slate-50 hover:-translate-y-0.5 transition-all text-slate-700" 
                      variant="outline"
                      disabled={billItems.length === 0 || isSaving}
                      onClick={() => saveBillToDB('cash')}
                      tabIndex={6}
                    >
                      Cash Check
                    </Button>
                    <Button 
                      className="w-full sm:w-1/2 h-14 rounded-2xl text-base font-bold shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 text-white transition-all" 
                      disabled={billItems.length === 0 || isSaving}
                      onClick={handleRazorpayCheckout}
                      tabIndex={7}
                    >
                      {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                      Razorpay
                    </Button>
                  </>
                )}
              </div>
            </CardFooter>
          </Card>
          )}
           </div>
        </div>

      </div>

      {/* Hidden Invoice Template for Printing */}
      <div className="hidden">
        {successBillData && (
          <InvoiceTemplate 
            ref={printRef}
            bill={{ bill_number: successBillData.billNumber, customer_name: successBillData.customerName, customer_phone: successBillData.customerPhone, total_amount: successBillData.amount, gst_amount: successBillData.gstAmount }} 
            items={successBillData.items} 
            store={storeData} 
            qrCodeUrl={successBillData.qrUrl}
          />
        )}
      </div>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
