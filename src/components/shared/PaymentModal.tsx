"use client";

/**
 * DawaBill — PaymentModal Component
 *
 * MEDICAL-GRADE REDESIGN: Clean, trusted pharmacy checkout overlay.
 * Shows a "Redirecting to secure payment..." message while Razorpay SDK loads.
 * Controlled by parent (SubscriptionPaymentWrapper) via isOpen prop.
 */

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Lock } from "lucide-react";

interface PaymentModalProps {
  isOpen: boolean;
  planName: string | null;
  price?: number;
}

export default function PaymentModal({ isOpen, planName, price }: PaymentModalProps) {
  const [dots, setDots] = useState(".");

  // Animated loading dots
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment in progress"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
    >
      {/* Backdrop: Clean medical-grade blur */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" />

      {/* Modal Card: Premium Pharmacy White Card */}
      <div className="relative z-10 bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-slate-100 p-10 max-w-sm w-full animate-in zoom-in-95 fade-in duration-500">
        
        {/* Protection Icon: Medical Teal */}
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-primary/10">
          <ShieldCheck size={48} strokeWidth={1.5} />
        </div>

        {/* Plan Identification Badge */}
        {planName && (
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-500 border border-slate-100 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
              {planName} Subscription
              {price && price > 0 ? ` · ₹${price}` : ""}
            </span>
          </div>
        )}

        <h2 className="text-2xl font-bold text-slate-900 text-center tracking-tight mb-2">
          Secure Checkout
        </h2>
        <p className="text-slate-500 text-sm font-medium text-center mb-8 px-4">
           Verifying connection with our secure payment gateway...
        </p>

        {/* Animated Redirect Status */}
        <div className="flex flex-col items-center justify-center gap-4 py-8 bg-slate-50/50 rounded-[32px] border border-slate-100 mb-8">
          <div className="relative">
             <Loader2 className="h-10 w-10 text-primary animate-spin" strokeWidth={1.5} />
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
             </div>
          </div>
          <p className="text-slate-600 font-bold text-sm tracking-tight italic">
            Redirecting{dots}
          </p>
        </div>

        {/* Trust Footer */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100">
             <Lock size={12} />
             <span>256-bit SSL secured</span>
          </div>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em] mt-2">
            Service provided by Razorpay
          </p>
        </div>
      </div>
    </div>
  );
}
