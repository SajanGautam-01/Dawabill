"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, ShieldCheck, Sparkles, ChevronRight, ScanLine, Smartphone } from "lucide-react";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * DawaBill — Smart Bill Scanner
 * 
 * MEDICAL-GRADE REDESIGN: Professional OCR landing page.
 * Replaces 'Neural Vision' with trusted pharmacy scanning terminology.
 */

const OCRScanner = dynamic(() => import("./OCRScanner"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-700">
      <div className="relative">
        <Loader2 className="h-20 w-20 animate-spin text-primary opacity-20" strokeWidth={1.5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 bg-primary/10 rounded-full animate-pulse flex items-center justify-center">
             <ScanLine className="text-primary h-6 w-6" />
          </div>
        </div>
      </div>
      <div className="text-center space-y-3">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Initializing Bill Scanner</p>
        <p className="text-xs text-slate-400 font-medium italic">Preparing secure scanning environment...</p>
      </div>
    </div>
  ),
});

export default function OCRPage() {
  const [mounted, setMounted] = useState(false);
  const { canUseOCR, isAllowed, loading } = useSubscriptionGuard();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary/30" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 italic">Verifying Access Permissions...</p>
      </div>
    );
  }

  // Restricted Access View (Medical-Grade)
  if (!canUseOCR || !isAllowed) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-700">
        <div className="relative mb-12">
          <div className="absolute -inset-6 bg-primary/10 rounded-[3rem] blur-3xl" />
          <div className="relative w-28 h-28 bg-white border border-slate-100 text-primary rounded-[3rem] flex items-center justify-center shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)]">
            <ScanLine size={56} strokeWidth={1.5} />
          </div>
          <Badge className="absolute -top-3 -right-3 px-4 py-1.5 shadow-lg ring-4 ring-white bg-primary text-white font-bold uppercase tracking-widest text-[10px]">Professional</Badge>
        </div>
        
        <h2 className="text-5xl font-bold tracking-tight mb-4 text-slate-900">Smart <span className="text-primary italic">Bill Scanner</span></h2>
        <p className="text-slate-500 mt-4 max-w-lg font-medium text-lg mb-12 leading-relaxed">
          Automated stock intake and batch extraction is a professional feature designed to save you hours of manual data entry.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/settings/subscription">
            <Button size="lg" className="h-16 px-10 rounded-2xl font-bold text-lg gap-2 shadow-2xl shadow-primary/20 group active:scale-95 transition-all">
              Upgrade to Professional Plan
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="https://wa.me/919876543210" target="_blank">
             <Button variant="outline" className="h-16 px-10 rounded-2xl font-bold text-lg border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
               Request a Demo
             </Button>
          </Link>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-12 border-t border-slate-100">
           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"><ShieldCheck size={16} className="text-primary"/> 100% Accurate Data</div>
           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"><Smartphone size={16} className="text-primary"/> Works on Android/iOS</div>
        </div>
      </div>
    );
  }

  // Active Scanner View
  return <OCRScanner />;
}
