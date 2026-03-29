"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/shared/Sidebar";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Define routes that should show the Sidebar
  const isInternalRoute = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/billing') || 
    pathname.startsWith('/inventory') || 
    pathname.startsWith('/ocr') || 
    pathname.startsWith('/reports') || 
    pathname.startsWith('/settings') || 
    pathname.startsWith('/support');

  return (
    <>
      {isInternalRoute ? (
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar />
          <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto">
            {children}
          </main>
        </div>
      ) : (
        children
      )}
    </>
  );
}
