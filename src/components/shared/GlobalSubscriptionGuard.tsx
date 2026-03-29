"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function GlobalSubscriptionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAllowed, daysRemaining, loading } = useSubscriptionGuard();

  // Exclude auth layer, landing, and renewal gate from the lock
  const isPublicRoute = pathname.startsWith('/auth') || pathname === '/' || pathname === '/settings/subscription';

  useEffect(() => {
    async function checkAuth() {
        if (loading) return;

        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session && !isPublicRoute) {
            router.push('/auth/login');
            return;
        }

        if (!isAllowed && !isPublicRoute) {
            router.push('/settings/subscription');
        }
    }
    checkAuth();
  }, [loading, isAllowed, pathname, isPublicRoute, router]);

  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAllowed && !isPublicRoute) {
    return null; // Prevents flashing expired content while Next router pushes
  }

  const showWarning = !loading && daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0;
  const showExpired = !loading && isAllowed === false;

  return (
    <>
      {/* 2. Banner: Renew to continue. 3. Reminder Logic: < 3 days */}
      {(showWarning || showExpired) && !pathname.includes('settings/subscription') && (
        <div className={`w-full text-center py-2.5 px-4 text-sm font-bold flex items-center justify-center gap-3 transition-all z-50 shadow-sm ${
           showExpired 
             ? "bg-red-600 text-white" 
             : "bg-amber-100 text-amber-800 border-b border-amber-200"
        }`}>
          <AlertTriangle size={16} strokeWidth={2.5} />
          <span>
            {showExpired 
              ? "Your plan has expired. Critical modules are locked."
              : `Subscription expires in ${daysRemaining} days. Renew now to avoid interruption.`
            }
          </span>
          <Link href="/settings/subscription" className={`underline underline-offset-2 flex items-center gap-1 hover:opacity-80 transition-opacity ${showExpired ? 'text-red-100' : 'text-amber-900'}`}>
            Upgrade Plan <ArrowRight size={14} />
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
