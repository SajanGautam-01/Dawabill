"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Package, Settings, LifeBuoy, Menu, X, ScanText } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "OCR Scan", href: "/ocr", icon: ScanText },
  { name: "Reports", href: "/reports", icon: Receipt }, 
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Support", href: "/support", icon: LifeBuoy },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Bar (Bug Check: Mobile Issue ✅) */}
      <div className="md:hidden flex items-center justify-between bg-white border-b p-4 text-blue-600 shadow-sm z-50 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">DB</span>
          </div>
          <span className="font-bold text-lg">DawaBill</span>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-700 p-1">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Content */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0f172a] text-white transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:w-64 flex flex-col shadow-xl ${isOpen ? 'translate-x-0 mt-[65px] md:mt-0' : '-translate-x-full'}`}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-inner">
            <span className="text-white font-bold">DB</span>
          </div>
          <span className="font-bold text-2xl text-blue-50 tracking-tight">DawaBill</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Main Menu</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            // Bug Check: Fast UI ✅ (Link prefetching is automatic in Next.js)
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link 
                key={item.href} 
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${
                  isActive 
                    ? "bg-blue-600 text-white font-medium shadow-md" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-50"
                }`}
              >
                <Icon size={20} className={isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"} />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 bg-slate-900 border-t border-slate-800">
           {/* Placeholder for Quick Actions or User Profile info */}
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
               <span className="text-xs text-slate-300">U</span>
             </div>
             <div className="flex flex-col">
               <span className="text-sm text-slate-200 font-medium truncate max-w-[120px]">My Store</span>
               <button 
                onClick={async () => {
                   await supabase.auth.signOut();
                   window.location.href = "/auth/login";
                }} 
                className="text-left text-xs text-slate-500 hover:text-slate-300 transition-colors"
               >
                 Sign out
               </button>
             </div>
           </div>
        </div>
      </div>
      
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden mt-[65px]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
