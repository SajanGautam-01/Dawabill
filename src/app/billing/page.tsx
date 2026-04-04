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
import { Plus, FileText, Loader2, IndianRupee, QrCode, Printer, WifiOff, CloudUpload, AlertTriangle, Tag, Award, Search, ShoppingCart, User, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { logger } from "@/lib/logger";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { ManualRecovery } from "@/components/subscription/ManualRecovery";
import ProductSearch, { Product } from "@/components/billing/ProductSearch";
import CartTable, { BillItem } from "@/components/billing/CartTable";
import { saveOfflineBill, getAllOfflineBills, deleteOfflineBill } from "@/lib/idb";
import { cn, formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type PaymentAccount = {
  id: string;
  upi_id: string;
  display_name: string;
  is_default: boolean;
};

export default function BillingPage() {
  const { storeId, userId, loading: storeLoading } = useStore();
  const { isAllowed, hoursInGracePeriod, loading: subLoading, checkSubscriptionSync } = useSubscriptionGuard();
  const isReadOnly = hoursInGracePeriod !== null;
  
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [selectedUpi, setSelectedUpi] = useState<string>("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPaymentInfo, setPendingPaymentInfo] = useState<any>(null);
  const [successBillData, setSuccessBillData] = useState<any>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string>("");

  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: successBillData ? `Invoice_${successBillData.billNumber}` : 'Invoice'
  });

  const roundTo2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
  
  const defaultGstRate = storeData?.default_gst || 12;
  
  useEffect(() => {
    const initOffline = async () => {
       const bills = await getAllOfflineBills();
       if (bills && bills.length > 0) setOfflineQueue(bills);
    };
    initOffline();

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineBills();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    if (storeId) {
      supabase.from('stores').select('id, store_name, address, phone, gst_number, dl_number, invoice_prefix, default_gst, invoice_logo, print_format, theme_color').eq('id', storeId).single()
        .then(({ data }) => setStoreData(data));
        
      supabase.from('payment_accounts').select('id, upi_id, is_active, display_name, is_default').eq('store_id', storeId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setPaymentAccounts(data);
            const defaultAcc = data.find(d => d.is_default) || data[0];
            setSelectedUpi(defaultAcc.upi_id);
          }
        });

      supabase.from('discounts').select('*').eq('store_id', storeId).eq('is_active', true)
        .then(({ data }) => { if (data) setAvailableDiscounts(data); });
        
      const scriptId = 'razorpay-checkout-js';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.body.appendChild(script);
      }
      
      setCurrentIdempotencyKey(globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
            ? { ...item, quantity: item.quantity + 1, total: roundTo2((item.quantity + 1) * item.sale_rate) }
            : item
        );
      }
      const gstRate = product.gst_rate ?? (storeData?.default_gst || 12);
      return [...prev, { ...product, gst_rate: gstRate, quantity: 1, total: roundTo2(product.sale_rate) }];
    });
    setError(null);
  }, [storeData]);

  const updateQuantity = useCallback((id: string, qtyStr: string, max: number) => {
    const qty = parseInt(qtyStr) || 1;
    if (qty > max) {
      setError(`Only ${max} items in stock for this product.`);
      return;
    }
    setError(null);
    setBillItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, quantity: qty, total: roundTo2(qty * item.sale_rate) }
        : item
    ));
  }, []);

  const removeItem = useCallback((id: string) => {
    setBillItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const subtotal = roundTo2(billItems.reduce((sum, item) => sum + item.total, 0));
  
  // New Item-wise GST Calculation (Inclusive Logic)
  const gstDetails = billItems.reduce((acc, item) => {
    const rate = item.gst_rate || 0;
    const itemTax = roundTo2(item.total - (item.total / (1 + (rate / 100))));
    return {
      totalTax: acc.totalTax + itemTax,
      slabs: { ...acc.slabs, [rate]: (acc.slabs[rate] || 0) + itemTax }
    };
  }, { totalTax: 0, slabs: {} as Record<number, number> });

  const gstAmount = roundTo2(gstDetails.totalTax);
  
  const selectedDiscount = availableDiscounts.find(d => d.id === selectedDiscountId);
  let discountValue = 0;
  if (selectedDiscount && subtotal >= (selectedDiscount.min_bill_amount || 0)) {
    if (selectedDiscount.discount_type === 'percentage') {
      discountValue = roundTo2(subtotal * (selectedDiscount.value / 100));
    } else {
      discountValue = roundTo2(selectedDiscount.value);
    }
  }

  const exactGrandTotal = subtotal - discountValue; // All totals are inclusive
  const grandTotal = Math.round(exactGrandTotal);
  const roundOff = roundTo2(grandTotal - exactGrandTotal);
  
  const earnedPoints = Math.floor(grandTotal / 100);

  const syncOfflineBills = async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const billsToSync = await getAllOfflineBills();
      if (billsToSync.length === 0) return;
      for (const bill of billsToSync) {
        try {
          const res = await fetch('/api/sync-offline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bill)
          });
          if (res.ok) await deleteOfflineBill(bill.idempotency_key);
        } catch (err) {
          console.error("Sync failed for", bill.bill_number, err);
        }
      }
      const newDocs = await getAllOfflineBills();
      setOfflineQueue(newDocs);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    if (!storeId) return setError("Authentication Error");
    if (billItems.length === 0) return setError("Add at least one item to bill.");
    if (!navigator.onLine) return setError("Razorpay checkout requires internet connection.");
    if (!(window as any).Razorpay) return setError("Payment gateway loading...");
    
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
        name: storeData?.store_name || "DawaBill",
        description: `${billItems.length} items bill`,
        order_id: orderData.order.id,
        modal: { ondismiss: () => setIsSaving(false) },
        handler: async (response: any) => {
           setPendingPaymentInfo(response);
           await executeVerifyAndSave(response);
        },
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError("Failed to initialize payment: " + err.message);
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
      if (!verifyRes.ok) throw new Error("Verification failed");
      await saveBillToDB(`razorpay:${response.razorpay_payment_id}`, response.razorpay_order_id);
      setPendingPaymentInfo(null);
    } catch (e: any) {
      setError("Verification failed. Please retry.");
      setIsSaving(false);
    }
  };

  const saveBillToDB = async (paymentMode: string = 'cash', transactionId: string | null = null) => {
    if (!storeId) return setError("Auth Error");
    setIsSaving(true);

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
         created_at: new Date().toISOString()
       };
       await saveOfflineBill(newOfflineBill);
       setOfflineQueue(await getAllOfflineBills());
       setSuccessBillData({ billNumber, amount: grandTotal, gstAmount, items: billItems, isOffline: true });
       setBillItems([]); setCustomerName(""); setCustomerPhone("");
       setIsSaving(false);
       return;
    }

    const itemsForRPC = billItems.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      sale_rate: item.sale_rate,
      gst_rate: item.gst_rate
    }));

    try {
      const { data, error: rpcError } = await supabase.rpc('create_bill_v5', {
        p_store_id: storeId,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_payment_mode: paymentMode,
        p_items: itemsForRPC,
        p_idempotency_key: currentIdempotencyKey,
        p_external_transaction_id: transactionId,
        p_discount_id: selectedDiscountId
      });
      
      if (rpcError || !data?.success) throw new Error(rpcError?.message || data?.error || "Transaction failed");

      const upiUri = `upi://pay?pa=${selectedUpi}&pn=DawaBill%20Store&am=${grandTotal.toFixed(2)}&cu=INR`;
      const qrUrl = selectedUpi ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}` : null;

      setSuccessBillData({
        billNumber: data.bill_number,
        amount: grandTotal,
        gstAmount,
        gstSlabs: gstDetails.slabs,
        roundOff,
        items: billItems,
        qrUrl,
        customerName: customerName || 'Walk-in',
        customerPhone: customerPhone || ''
      });
      setBillItems([]); setCustomerName(""); setCustomerPhone("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const startNewBill = () => {
    setSuccessBillData(null);
    setCurrentIdempotencyKey(globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
  };

  if (storeLoading || subLoading) return <div className="flex h-screen items-center justify-center animate-pulse">Loading Environment...</div>;

  if (isAllowed === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl"><AlertTriangle size={36}/></div>
        <h2 className="text-4xl font-black text-slate-900 leading-tight">Billing Restricted</h2>
        <p className="text-slate-500 mt-4 mb-8 max-w-md mx-auto font-medium">Subscription expired. Renew to continue billing.</p>
        <Link href="/settings/subscription"><Button size="lg" className="h-14 px-8 rounded-2xl font-bold bg-red-600 text-white">Renew Plan</Button></Link>
        <ManualRecovery userId={userId || ""} onSuccess={() => checkSubscriptionSync()} />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2">
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-100 font-bold uppercase tracking-widest text-[9px]">Live POS</Badge>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Sale <span className="text-primary italic">Billing</span></h1>
          <p className="text-slate-500 font-medium">Quickly generate bills and manage your storefront.</p>
        </div>
        <div className="flex items-center gap-4">
          {!isOnline && (
            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 animate-pulse font-bold gap-2 h-10 px-4">
              <WifiOff size={14} /> Offline Mode
            </Badge>
          )}
          {offlineQueue.length > 0 && <Button variant="outline" onClick={syncOfflineBills} disabled={isSyncing} className="rounded-xl h-12 px-6 font-bold gap-2 border-amber-200 text-amber-700">{isSyncing ? <Loader2 className="animate-spin h-4 w-4" /> : <CloudUpload size={18} />} Sync {offlineQueue.length}</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-7 space-y-8">
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <CardHeader className="p-5 md:p-8 border-b border-slate-50 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><User size={20} /></div>
                  <div><CardTitle className="text-lg md:text-xl font-bold">Customer Info</CardTitle><CardDescription className="text-[10px] md:text-xs font-medium">Buyer details</CardDescription></div>
                </div>
            </CardHeader>
            <CardContent className="p-5 md:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400">Name</Label><Input placeholder="John Doe" className="h-11 md:h-12 font-bold text-base rounded-xl" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400">Phone</Label><Input placeholder="9988776655" className="h-11 md:h-12 font-bold text-base rounded-xl" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} /></div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
             <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground px-4 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-primary rounded-full" /> Catalog Search</h2>
                <ProductSearch storeId={storeId!} onAddProduct={addProductToBill} />
             </div>
             <div className="space-y-4">
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground px-4 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-primary rounded-full" /> Cart Items</h2>
                <CartTable items={billItems} isSaving={isSaving} onUpdateQuantity={updateQuantity} onRemoveItem={removeItem} />
             </div>
          </div>
        </div>

        <div className="xl:col-span-5">
           <AnimatePresence mode="wait">
           {successBillData ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card className="rounded-[2.5rem] border-emerald-100 bg-white shadow-2xl overflow-hidden">
                <div className="h-3 bg-emerald-500" />
                <CardContent className="p-8 md:p-12 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm"><CheckCircle2 size={40} /></div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2 leading-tight">Bill Created</h2>
                  <p className="text-slate-500 font-medium mb-10">{successBillData.isOffline ? 'Saved for background sync.' : `Invoice: ${successBillData.billNumber}`}</p>
                  <div className="w-full bg-slate-50 p-8 rounded-[2rem] border border-slate-100 mb-10">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-3">Total Amount</p>
                    <div className="text-4xl md:text-5xl font-bold text-primary tracking-tight">₹{successBillData.amount.toFixed(2)}</div>
                  </div>
                  {successBillData.qrUrl && <div className="w-full flex flex-col items-center gap-4 py-4"><div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm"><img src={successBillData.qrUrl} alt="Payment QR" className="w-32 h-32 md:w-40 md:h-40" /></div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">UPI QR</p></div>}
                </CardContent>
                <CardFooter className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                   <Button variant="outline" className="w-full sm:flex-1 h-12 rounded-xl font-bold gap-2 border-slate-200 bg-white" onClick={handlePrint}><Printer size={18} /> Print</Button>
                   <Button className="w-full sm:flex-1 h-12 rounded-xl font-bold gap-2 shadow-md" onClick={startNewBill}><Plus size={18} /> Next Bill</Button>
                </CardFooter>
              </Card>
            </motion.div>
           ) : (
            <motion.div key="checkout" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="xl:sticky xl:top-24">
              <Card className="border-slate-200 shadow-sm rounded-[2rem] overflow-hidden bg-white">
                <CardHeader className="p-6 md:p-8 border-b border-slate-50 bg-slate-50/50">
                   <CardTitle className="text-lg md:text-xl font-bold flex items-center justify-between">Summary <Badge variant="outline" className="text-primary bg-primary/10 border-primary/20 font-bold uppercase text-[10px]">{billItems.length} Items</Badge></CardTitle>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-6">
                   <div className="flex items-center justify-between p-4 bg-primary/5 rounded-[1.25rem] border border-primary/10">
                     <div className="flex items-center gap-3"><Tag size={16} className="text-primary" /><span className="text-[10px] font-bold uppercase text-slate-500">Discount</span></div>
                     <select className="bg-transparent border-none text-primary font-bold text-sm focus:ring-0 cursor-pointer text-right px-2" value={selectedDiscountId || ""} onChange={(e) => setSelectedDiscountId(e.target.value || null)}><option value="">None</option>{availableDiscounts.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}</select>
                   </div>
                   <div className="space-y-4">
                     <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[9px]"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                     <div className="flex justify-between items-center text-slate-400 font-bold uppercase text-[9px]"><span>GST (12%)</span><span className="text-primary">+ ₹{gstAmount.toFixed(2)}</span></div>
                     {discountValue > 0 && <div className="flex justify-between items-center text-emerald-600 font-bold uppercase text-[9px]"><span>Discount</span><span>- ₹{discountValue.toFixed(2)}</span></div>}
                     <div className="pt-6 border-t border-slate-100 mt-4">
                        <div className="flex justify-between items-end gap-4"><span className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Total Payable</span><div className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-none">₹{grandTotal.toFixed(2)}</div></div>
                     </div>
                     <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 flex items-center justify-between"><div className="flex items-center gap-2 text-[9px] font-bold uppercase text-amber-600"><Award size={14} /> Rewards</div><div className="text-xs font-bold text-amber-700">+{earnedPoints} pts</div></div>
                   </div>
                </CardContent>
                <CardFooter className="p-6 md:p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-4">
                   {pendingPaymentInfo ? <Button className="w-full h-14 rounded-2xl font-bold text-lg" disabled={isSaving} onClick={() => executeVerifyAndSave(pendingPaymentInfo)}>{isSaving ? <Loader2 className="animate-spin" /> : "Verify Payment"}</Button> : (
                     <div className="flex flex-col sm:flex-row gap-4 w-full">
                       <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold text-lg border-slate-200 bg-white shadow-sm" disabled={billItems.length === 0 || isSaving || isReadOnly} onClick={() => saveBillToDB('cash')}>{isSaving ? <Loader2 className="animate-spin" /> : "Cash"}</Button>
                       <Button className="flex-1 h-14 rounded-2xl font-bold text-lg gap-3 shadow-lg text-white" disabled={billItems.length === 0 || isSaving || isReadOnly} onClick={handleRazorpayCheckout}>{isSaving ? <Loader2 className="animate-spin" /> : <Smartphone size={18} />} Online</Button>
                     </div>
                   )}
                   {isReadOnly && <div className="flex items-center justify-center gap-2 text-[9px] font-bold uppercase text-red-500 tracking-widest"><AlertTriangle size={12} /> Restricted</div>}
                </CardFooter>
              </Card>
            </motion.div>
           )}
           </AnimatePresence>
        </div>
      </div>

      <div className="hidden">{successBillData && <InvoiceTemplate ref={printRef} bill={{ bill_number: successBillData.billNumber, customer_name: successBillData.customerName, customer_phone: successBillData.customerPhone, total_amount: successBillData.amount, gst_amount: successBillData.gstAmount, round_off: successBillData.roundOff, gst_slabs: successBillData.gstSlabs }} items={successBillData.items} store={storeData} qrCodeUrl={successBillData.qrUrl} />}</div>
    </div>
  );
}
