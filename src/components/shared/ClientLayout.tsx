"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/shared/Sidebar";
import Navbar from "@/components/shared/Navbar";
import { useStore } from "@/hooks/useStore";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, Sparkles } from "lucide-react";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading: storeLoading } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Define public/auth routes
  const isAuthRoute = pathname.startsWith('/auth');
  const isLanding = pathname === '/';
  
  // All internal app-level routes
  const isInternalRoute = !isAuthRoute && !isLanding || pathname === '/dashboard';

  if (!isInternalRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-foreground selection:bg-primary/30 font-sans">
      
      {/* ── PHASE 1: IDENTITY SHROUD ────────────────────────────────────────── */}
      {/* Masks the initial 'Access Restricted' flicker during data resolution */}
      <AnimatePresence>
        {storeLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center gap-8"
          >
            <div className="relative group">
               <div className="absolute -inset-4 bg-primary/20 rounded-[2rem] blur-2xl group-hover:bg-primary/30 transition-all duration-1000 animate-pulse" />
               <div className="relative w-20 h-20 bg-slate-50 border border-slate-200 rounded-[2rem] flex items-center justify-center shadow-2xl">
                  <Zap className="text-primary h-10 w-10 animate-bounce" fill="currentColor" strokeWidth={2.5} />
               </div>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-slate-800 font-black tracking-tighter text-3xl">
                Daba<span className="text-primary italic">Bill</span>
                <span className="text-[10px] font-black uppercase text-primary/60 tracking-[0.4em] mt-2 flex items-center gap-1.5 ml-2">
                   <Sparkles size={8} /> Secure Sync
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] font-display">
                <Loader2 className="animate-spin h-3 w-3" />
                Synchronizing Pharmacy Data...
              </div>
            </div>
            
            {/* Visual Fidelity Bar */}
            <div className="w-48 h-0.5 bg-slate-100 rounded-full overflow-hidden relative">
               <motion.div 
                 initial={{ width: "0%" }}
                 animate={{ width: "100%" }}
                 transition={{ duration: 4, ease: "linear" }}
                 className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_10px_rgba(16,185,129,0.8)]"
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        
        {/* ── PHASE 2: PLATINUM BACKGROUNDS ───────────────────────────────────── */}
        {/* Ambient background glows for world-class high-scale SaaS feel */}
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-primary/[0.04] blur-[150px] -z-10 pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/[0.03] blur-[150px] -z-10 pointer-events-none" />
        
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
          <div className="max-w-[1600px] mx-auto w-full p-4 md:p-8 lg:p-10 min-h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.99 }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="w-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
