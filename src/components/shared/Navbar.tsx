"use client";

import { useStore } from "@/hooks/useStore";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { 
  Bell, 
  Search, 
  Store, 
  Activity,
  Zap,
  ShoppingCart,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { storeName, loading: storeLoading } = useStore();
  const { daysRemaining } = useSubscriptionGuard();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full transition-all duration-300 px-4 md:px-8 bg-white/80 backdrop-blur-md",
      scrolled ? "border-b border-slate-200 py-2 shadow-sm" : "py-4"
    )}>
      <div className="flex h-14 items-center justify-between gap-4 max-w-[1600px] mx-auto">
        
        {/* ── STAGE 1: IDENTITY ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuClick}
            className="md:hidden h-10 w-10 rounded-xl bg-slate-50 border border-slate-200"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </Button>

          <div className="hidden sm:flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-sm">
               <Store size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900 line-clamp-1 max-w-[120px] lg:max-w-none">
                {storeLoading ? "Syncing..." : storeName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Online</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── STAGE 2: SMART SEARCH (NOTION STYLE) ─────────────────────────── */}
        <div className="hidden lg:flex flex-1 max-w-xl relative group mx-4">
           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
              <Search size={18} />
           </div>
           <input 
             type="text" 
             placeholder="Search inventory..." 
             className="w-full h-11 bg-slate-50 border-slate-200 rounded-xl pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:bg-white focus:border-primary/20 transition-all border"
           />
           <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden xl:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 border border-slate-300 text-[9px] font-bold text-slate-500">/</kbd>
           </div>
        </div>

        {/* ── STAGE 3: ACTIONS & SYSTEM STATUS ─────────────────────────────── */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          
          <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
             <Activity size={14} className="text-emerald-600" />
             <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none">
                {daysRemaining !== null ? `${daysRemaining} Days` : "Active"}
             </span>
          </div>

          <div className="flex items-center gap-2">
             <Link href="/billing">
               <Button className="h-10 px-4 md:px-5 rounded-xl font-bold text-xs gap-2 shadow-sm transition-all active:scale-95 whitespace-nowrap">
                 <ShoppingCart size={16} />
                 <span className="hidden sm:inline">New Bill</span>
               </Button>
             </Link>

             <Link href="/ocr" className="hidden xs:block">
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all shadow-sm">
                   <Zap size={18} />
                </Button>
             </Link>

             <div className="relative">
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all">
                  <Bell size={18} />
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white" />
                </Button>
             </div>

             <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-xs text-white shadow-md cursor-pointer hover:shadow-lg transition-all active:scale-90 shrink-0">
                SC
             </div>
          </div>
        </div>
      </div>
    </header>
  );
}
