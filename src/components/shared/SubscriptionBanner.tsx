"use client";

import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { AlertTriangle, ArrowRight, Clock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

export default function SubscriptionBanner() {
  const pathname = usePathname();
  const { isAllowed, daysRemaining, hoursInGracePeriod, loading, status } = useSubscriptionGuard();
  const { toast } = useToast();
  const toastShownRef = useRef(false);

  useEffect(() => {
    // 24-Hour Reminder logic: Trigger toast once when daysRemaining is exactly 1
    if (daysRemaining === 1 && !loading && status === 'trial' && !toastShownRef.current) {
      toast("Your trial ends in 24 hours. Upgrade now to ensure your pharmacy data remains editable!", "info");
      toastShownRef.current = true;
    }
  }, [daysRemaining, loading, status, toast]);

  if (loading || pathname === '/settings/subscription') return null;

  const isGracePeriod = hoursInGracePeriod !== null;
  const isEndingSoon = daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;

  if (!isGracePeriod && !isEndingSoon) return null;

  return (
    <div className={`w-full text-center py-3 px-4 text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-3 transition-all z-50 shadow-lg border-b ${
      isGracePeriod 
        ? "bg-amber-600 text-white border-amber-700 animate-in slide-in-from-top duration-500" 
        : "bg-amber-50 text-amber-800 border-amber-200"
    }`}>
      <div className="flex items-center gap-2">
        {isGracePeriod ? <ShieldAlert size={18} className="animate-pulse" /> : <Clock size={18} />}
        <span className="tracking-tight">
          {isGracePeriod 
            ? `ACCESS EXPIRING: ${hoursInGracePeriod.toFixed(1)} hours until full account suspension.`
            : `Trial ending soon: ${daysRemaining ?? 0} day${(daysRemaining ?? 0) > 1 ? 's' : ''} left. Subscribe now to lock in your settings.`
          }
        </span>
      </div>
      <Link 
        href="/settings/subscription" 
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all active:scale-95 text-xs font-black uppercase ${
          isGracePeriod 
            ? 'bg-white text-amber-700 hover:bg-amber-50 shadow-sm' 
            : 'bg-amber-800 text-white hover:bg-amber-900'
        }`}
      >
        Upgrade Now <ArrowRight size={14} />
      </Link>
    </div>
  );
}
