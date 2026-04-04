"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Receipt, 
  Package, 
  Settings, 
  LifeBuoy, 
  Menu, 
  X, 
  ScanText, 
  Lock,
  LogOut,
  Users,
  Store
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Stock Inventory", href: "/inventory", icon: Package },
  { name: "Scan Bill", href: "/ocr", icon: ScanText, premium: true },
  { name: "Customers", href: "/customers", icon: Users }, 
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Support", href: "/support", icon: LifeBuoy },
];

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const pathname = usePathname();
  const { planName, loading, canUseOCR } = useSubscriptionGuard();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [setIsOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-all duration-300 md:translate-x-0 md:static md:h-screen flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Store className="text-white h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900">Dawa<span className="text-primary italic">Bill</span></span>
              <span className="text-[10px] font-bold uppercase text-primary tracking-widest leading-none mt-1">Pharmacy POS</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="md:hidden">
            <X size={20} />
          </Button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pt-2">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Main Menu</p>
          
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isLocked = item.premium && !canUseOCR && item.name === "Scan Bill";
              
              return (
                <Link 
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl transition-all group relative",
                    isActive 
                      ? "bg-teal-50 text-primary font-bold border-l-4 border-primary rounded-l-none" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className={cn(isActive ? "text-primary" : "group-hover:text-slate-900")} />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  
                  {isLocked && (
                    <Lock size={14} className="text-slate-300" />
                  )}
                  
                  {item.premium && !isLocked && (
                    <Badge variant="outline" className="text-[9px] font-bold text-primary border-primary/20 bg-primary/5">PRO</Badge>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center text-primary">
                 <Store size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{planName || "Standard"} Plan</span>
                <span className="text-sm font-bold text-slate-900 truncate">Shop Profile</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-10 justify-center gap-2 rounded-xl text-xs font-bold border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all text-slate-600"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </Button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
