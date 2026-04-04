"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loader2, ShieldCheck, HelpCircle, ArrowRight, X, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ManualRecoveryProps {
  onSuccess: () => void;
  userId: string;
}

export function ManualRecovery({ onSuccess, userId }: ManualRecoveryProps) {
  const [paymentId, setPaymentId] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  const handleVerify = async () => {
    if (!paymentId.trim().startsWith("pay_")) {
      setError("Please enter a valid Payment ID (starts with 'pay_')");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/razorpay/sub-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId.trim(),
          manual_recovery: true,
          user_id: userId,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess();
      } else {
        setError(data.message || "Invalid Payment ID. Please check and try again.");
      }
    } catch (err) {
      setError("Connection error. Please check your internet and try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!showInput ? (
          <motion.button 
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInput(true)}
            className="text-slate-400 hover:text-primary text-[10px] font-bold uppercase tracking-widest mt-8 flex items-center gap-2 mx-auto transition-all active:scale-95 group"
          >
            <HelpCircle size={12} className="group-hover:rotate-12 transition-transform" /> 
            Already paid? Verify payment
          </motion.button>
        ) : (
          <motion.div 
            key="input-form"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="mt-10 p-8 bg-white border border-slate-200 rounded-3xl w-full max-w-sm mx-auto shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
               <button onClick={() => setShowInput(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                  <X size={18} />
               </button>
            </div>

            <div className="flex items-center gap-4 mb-8 text-slate-900">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <ShieldCheck size={22} />
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold uppercase text-primary tracking-widest leading-none mb-1">Verify payment</span>
                 <span className="text-lg font-bold tracking-tight">Access Recovery</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2.5">
                <Input 
                  placeholder="pay_..." 
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  disabled={isVerifying}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:border-primary transition-all text-sm font-mono tracking-widest font-bold"
                />
                <div className="flex items-center justify-center gap-1.5 opacity-60">
                   <Mail size={10} className="text-slate-400" />
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">
                     Check your email for Payment ID
                   </p>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="text-[10px] text-red-600 font-bold bg-red-50 p-4 rounded-xl border border-red-100 uppercase tracking-widest leading-relaxed text-center"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button 
                onClick={handleVerify}
                disabled={isVerifying || !paymentId.trim()}
                className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/10 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Activate Access</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
