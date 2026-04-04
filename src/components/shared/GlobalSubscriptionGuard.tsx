"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, AlertTriangle, ArrowRight, RefreshCw, WifiOff, ShieldAlert, Lock, Hospital, ShieldCheck } from "lucide-react";
import Link from "next/link";
import SubscriptionBanner from "./SubscriptionBanner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

/**
 * DawaBill — GlobalSubscriptionGuard
 * 
 * MEDICAL-GRADE REDESIGN: Clean, trusted loading and access control.
 * Replaces 'Terminal Locked' with professional 'Access Suspended' UI.
 */

const SystemLoader = ({ message, subtext }: { message: string, subtext: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 overflow-hidden">
    <div className="absolute inset-0 overflow-hidden opacity-5">
       <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
    </div>
    
    <div className="relative z-10 flex flex-col items-center">
      <div className="relative mb-12">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="w-24 h-24 rounded-[2rem] border-2 border-slate-100 border-t-primary shadow-sm"
        />
        <div className="absolute inset-0 flex items-center justify-center">
           <Hospital className="text-primary h-8 w-8 animate-pulse" />
        </div>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
          {message}
        </h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">
          {subtext}
        </p>
      </motion.div>
    </div>
  </div>
);

export default function GlobalSubscriptionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    isAllowed,
    loading,
    isSyncing,
    status,
    recoveryAttempts,
    hasError,
    authLoading,
    storeLoading,
  } = useSubscriptionGuard();

  const [mounted, setMounted] = useState(false);
  const [globalTimeout, setGlobalTimeout] = useState(false);
  const globalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCurrentlyBlocking = (authLoading || storeLoading || loading || isSyncing);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isCurrentlyBlocking && !isPublicRoute) {
      if (globalTimerRef.current) clearTimeout(globalTimerRef.current);
      setGlobalTimeout(false);
      globalTimerRef.current = setTimeout(() => {
        setGlobalTimeout(true);
      }, 10000);
    } else {
      if (globalTimerRef.current) {
        clearTimeout(globalTimerRef.current);
        globalTimerRef.current = null;
      }
      setGlobalTimeout(false);
    }
    return () => {
      if (globalTimerRef.current) clearTimeout(globalTimerRef.current);
    };
  }, [isCurrentlyBlocking]);

  const isPublicRoute =
    pathname.startsWith('/auth') ||
    pathname === '/' ||
    pathname === '/settings/subscription';

  useEffect(() => {
    if (authLoading || loading) return;
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !isPublicRoute) {
        router.push('/auth/login');
      }
    }
    checkAuth();
  }, [authLoading, loading, isAllowed, pathname, isPublicRoute, router]);

  if (globalTimeout && !isPublicRoute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[3rem] p-12 border border-slate-100 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-10 border border-slate-200 shadow-inner">
            <WifiOff size={36} strokeWidth={2} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
            Sync Timeout
          </h2>
          <p className="text-slate-500 font-medium text-lg mb-10 leading-relaxed">
            The pharmacy sync timed out. <br />
            Please check your connection.
          </p>
          <div className="space-y-4">
            <Button
              onClick={() => window.location.reload()}
              className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              <RefreshCw size={18} strokeWidth={2.5} />
              <span>Retry Sync</span>
            </Button>
            <Link
              href="/auth/login"
              className="flex items-center justify-center w-full h-14 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all uppercase text-[10px] tracking-widest"
            >
              Sign Out
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!mounted) {
    return <div className="min-h-screen bg-white" />;
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // ── LOADING PHASES ───────────────────────────────────────────────────────────
  if (authLoading) {
    return <SystemLoader message="Verifying Identity" subtext="Checking Account Access" />;
  }

  if (storeLoading) {
    return <SystemLoader message="Resolving Store" subtext="Initializing Pharmacy Data" />;
  }

  if (loading && !isSyncing) {
    return <SystemLoader message="Securing Data" subtext="Verifying Subscription" />;
  }

  if (isSyncing) {
    return <SystemLoader message="Activating Account" subtext="Synchronizing Data" />;
  }

  // ── ERROR / RECOVERY EXHAUSTED ──────────────────────────────────────────────
  if ((recoveryAttempts >= 3 || hasError) && !isAllowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[3rem] p-12 border border-slate-100 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-10 border border-amber-100 shadow-inner">
            <AlertTriangle size={36} strokeWidth={2} />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
            Connection Delay
          </h2>
          <p className="text-slate-500 font-medium text-lg mb-10 leading-relaxed">
            The verification system is slow. <br />
            Checking in the background...
          </p>
          <div className="space-y-4">
            <Button
              onClick={() => window.location.reload()}
              className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              <span>Retry Verification</span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </Button>
            <a
              href="https://wa.me/919876543210"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full h-14 bg-emerald-50 text-emerald-600 font-bold rounded-2xl border border-emerald-100 uppercase text-[10px] tracking-widest transition-all hover:bg-emerald-100"
            >
              Contact Support
            </a>
          </div>
          <p className="mt-10 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
            Status: Sync Attempt {recoveryAttempts}/3
          </p>
        </motion.div>
      </div>
    );
  }

  // ── ACCESS SUSPENDED (Medical-Grade Error State) ───────────────────────────
  if (!isAllowed && !loading && status === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.03)_0%,transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-white rounded-[4rem] p-16 border border-slate-200 text-center shadow-[0_40px_80px_-12px_rgba(0,0,0,0.08)] relative z-10"
        >
          <div className="w-28 h-28 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-inner border border-red-100">
            <Lock size={48} strokeWidth={1.5} />
          </div>
          
          <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
             Access <br /> 
             <span className="text-primary italic">Suspended</span>
          </h1>
          
          <p className="text-slate-500 font-medium text-xl leading-relaxed mb-16 max-w-sm mx-auto">
            Your pharmacy license has expired. Please upgrade your plan to restore full access.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => router.push('/settings/subscription')}
              className="h-20 px-12 bg-primary text-white font-bold rounded-3xl shadow-xl shadow-primary/20 text-lg transition-all active:scale-95 flex items-center gap-3"
            >
              <span>Restore Access</span>
              <ShieldCheck size={24} />
            </Button>
          </div>
          
          <p className="mt-12 text-[10px] font-bold text-slate-300 uppercase tracking-[0.4em]">
             System Status: {status.toUpperCase()}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <SubscriptionBanner />
      {children}
    </>
  );
}
