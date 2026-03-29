"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useReactToPrint } from "react-to-print";
import { InvoiceTemplate } from "@/components/billing/InvoiceTemplate";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/Card";
import { 
  Search, Plus, Trash2, FileText, Loader2, IndianRupee, QrCode, Printer, WifiOff, CloudUpload, AlertTriangle,
  Camera, Scan, Tag, Award
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { Toast } from "@/components/ui/Toast";

type Product = {
  id: string;
  name: string;
  sale_rate: number;
  stock_quantity: number;
};

type BillItem = Product & {
  quantity: number;
  total: number;
};

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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
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
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const barcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: successBillData ? `Invoice_${successBillData.billNumber}` : 'Invoice'
  });

  const defaultGstRate = 0.12; // 12% default GST for simple build (Rule 1)
  
  useEffect(() => {
    // Check for offline bills in localStorage on load
    try {
      const queue = JSON.parse(localStorage.getItem('dawabill_offline_queue') || '[]');
      if (Array.isArray(queue) && queue.length > 0) setOfflineQueue(queue);
    } catch {
      // If storage is corrupted, reset to a safe default
      localStorage.removeItem('dawabill_offline_queue');
    }

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
  }, [storeId]);
  
  useEffect(() => {
    if (!storeId || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const fetchProducts = async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('id, name, sale_rate, stock_quantity')
          .eq('store_id', storeId)
          .ilike('name', `%${searchQuery}%`)
          .limit(10);
          
        if (data) setSearchResults(data);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, storeId]);

  useEffect(() => {
    return () => {
      // Ensure scanner is cleaned up on route change/unmount
      try {
        barcodeScannerRef.current?.clear();
      } catch {
        // ignore cleanup errors
      } finally {
        barcodeScannerRef.current = null;
      }
    };
  }, []);

  const addProductToBill = (product: Product) => {
    // Senior Dev Rule 2: Test feature - Handle out of stock simply
    if (product.stock_quantity <= 0) {
      setError(`Cannot add ${product.name}. Out of stock!`);
      return;
    }

    setBillItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) return prev; // block over-adding
        
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.sale_rate }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, total: product.sale_rate }];
    });
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
  };

  const handleBarcodeScan = () => {
    // If we're closing the scanner, clear it to prevent duplicate layers/camera locks.
    if (isScannerOpen) {
      try {
        barcodeScannerRef.current?.clear();
      } catch (e) {
        console.log(e);
      } finally {
        barcodeScannerRef.current = null;
        setIsScannerOpen(false);
      }
      return;
    }

    setIsScannerOpen(true);
    if (!isScannerOpen) {
      setTimeout(() => {
        // Ensure we don't render multiple scanners into the same container.
        if (barcodeScannerRef.current) return;

        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
        barcodeScannerRef.current = scanner;
        scanner.render((text) => {
          setSearchQuery(text);
          try {
            scanner.clear();
          } catch (e) {
            console.log(e);
          } finally {
            barcodeScannerRef.current = null;
          }
          setIsScannerOpen(false);
        }, (err) => console.log(err));
      }, 500);
    }
  };

  const updateQuantity = (id: string, qtyStr: string, max: number) => {
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
  };

  const removeItem = (id: string) => {
    setBillItems(prev => prev.filter(item => item.id !== id));
  };

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
    if (offlineQueue.length === 0 || !navigator.onLine) return;
    if (localStorage.getItem('sync_lock') === 'true') return;
    
    localStorage.setItem('sync_lock', 'true');
    setIsSyncing(true);
    
    try {
      let successCount = 0;
      let failCount = 0;
      
      // Clone arrays to safely iterate while modifying the source
      const currentQueue = [...offlineQueue];
      let remainingQueue = [...offlineQueue];

      for (const bill of currentQueue) {
        if (bill.sync_status === 'success') continue;

        try {
          // 1. Prepare items for the atomic RPC
          const itemsForRPC = bill.items.map((item: any) => ({
            product_id: item.id,
            quantity: item.quantity,
            sale_rate: item.sale_rate || item.price 
          }));

          // 2. Call the Atomic RPC (Hardened v5 with Idempotency)
          const { data: rpcResponse, error: rpcError } = await supabase.rpc('create_bill_v5', {
            p_store_id: bill.store_id,
            p_customer_name: bill.customer_name,
            p_customer_phone: bill.customer_phone,
            p_payment_mode: bill.payment_mode,
            p_items: itemsForRPC,
            p_idempotency_key: bill.idempotency_key,
            p_external_transaction_id: bill.external_transaction_id || null,
            p_discount_id: bill.discount_id || null
          });

          if (rpcError || !rpcResponse || !rpcResponse.success) {
             throw new Error(rpcError?.message || rpcResponse?.error || "Atomic sync failed");
          }

          successCount++;
          remainingQueue = remainingQueue.filter(b => b.bill_number !== bill.bill_number);
          setOfflineQueue(remainingQueue);
          localStorage.setItem('dawabill_offline_queue', JSON.stringify(remainingQueue));
        } catch (itemError) {
          console.error(`Failed to sync offline bill ${bill.bill_number}:`, itemError);
          failCount++;
          
          // Mark as FAILED in local storage with retry increment
          remainingQueue = remainingQueue.map(b => 
            b.bill_number === bill.bill_number 
              ? { ...b, sync_status: 'failed', retry_count: (b.retry_count || 0) + 1 } 
              : b
          );
          setOfflineQueue(remainingQueue);
          localStorage.setItem('dawabill_offline_queue', JSON.stringify(remainingQueue));
        }
      }
      
      // Final User Feedback
      if (failCount === 0 && successCount > 0) {
        setToast({ message: "All offline bills synced successfully!", type: 'success' });
      } else if (failCount > 0) {
        setToast({ message: `Synced ${successCount} bills. ${failCount} failed.`, type: 'error' });
      }

    } catch (e) {
      console.error("Critical Sync Loop Error:", e);
      setToast({ message: "Sync process encountered an error.", type: 'error' });
    } finally {
      setIsSyncing(false);
      localStorage.removeItem('sync_lock');
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
       const updatedQueue = [...offlineQueue, newOfflineBill];
       setOfflineQueue(updatedQueue);
       localStorage.setItem('dawabill_offline_queue', JSON.stringify(updatedQueue));
       
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
                <div className="relative group flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5 group-focus-within:text-teal-500 transition-colors" />
                    <Input 
                      placeholder="Type product name or use scanner..." 
                      className="pl-12 h-14 rounded-2xl border-2 border-slate-200 bg-slate-50 focus-visible:ring-4 focus-visible:ring-teal-500/20 focus-visible:border-teal-500 focus-visible:bg-white transition-all text-lg font-medium shadow-sm w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      tabIndex={3}
                    />
                    {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 animate-spin" />}
                  </div>
                  <Button 
                    variant="outline"
                    onClick={handleBarcodeScan}
                    className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all ${isScannerOpen ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-teal-500 hover:border-teal-200'}`}
                  >
                    {isScannerOpen ? <Scan className="animate-pulse" /> : <Camera />}
                  </Button>
                </div>

                {isScannerOpen && (
                  <div id="reader" className="w-full mt-4 rounded-3xl overflow-hidden border-4 border-dashed border-slate-100 bg-slate-50 min-h-[300px]"></div>
                )}

              {/* Search Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-6 right-6 top-[90px] z-50 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProductToBill(p)}
                      className="w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-teal-50/80 focus:bg-teal-50/80 focus:outline-none transition-all flex justify-between items-center first:rounded-t-2xl last:rounded-b-2xl last:border-0"
                      tabIndex={4}
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">Stock: {p.stock_quantity}</p>
                      </div>
                      <div className="font-medium text-blue-600">₹{p.sale_rate}</div>
                    </button>
                  ))}
                </div>
              )}
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
              <div className="max-h-[350px] overflow-y-auto pr-1">
                {billItems.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 font-medium">
                    No items added yet.<br/>Search and select a product to begin.
                  </div>
                ) : (
                  billItems.map(item => (
                    <div key={item.id} className="p-4 mx-2 my-2 bg-slate-50/80 rounded-2xl hover:bg-white hover:shadow-md hover:-translate-y-0.5 hover:border-blue-100 border border-transparent transition-all flex items-start justify-between group">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-base leading-tight">{item.name}</p>
                        <p className="text-sm text-slate-500 mt-1.5 font-medium">₹{item.sale_rate} x </p>
                        <div className="flex items-center gap-3 mt-2.5">
                          <Input 
                            type="number" 
                            min="1" 
                            max={item.stock_quantity}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, e.target.value, item.stock_quantity)}
                            className="h-10 w-24 rounded-xl text-base font-bold border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 px-3 bg-white"
                            tabIndex={5}
                          />
                          <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-md">/{item.stock_quantity} left</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3 ml-4">
                        <span className="font-black text-slate-900 text-lg tracking-tight">₹{item.total.toFixed(2)}</span>
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all p-2 rounded-xl"
                          title="Remove item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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
