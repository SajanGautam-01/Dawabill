"use client";
import React, { useState, useEffect } from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectivityMonitor() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setTimeout(() => setShowBanner(false), 3000); // 3s success fade
    }

    function handleOffline() {
      setIsOnline(false);
      setShowBanner(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (!window.navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div className={cn(
      "fixed top-0 inset-x-0 z-[100] p-1.5 flex items-center justify-center gap-3 transition-all duration-500",
      isOnline ? "bg-emerald-600 animate-out fade-out slide-out-to-top" : "bg-rose-600 animate-in fade-in slide-in-from-top"
    )}>
      <div className="flex items-center gap-2 text-white font-bold text-sm">
        {isOnline ? (
          <React.Fragment>
            <AlertTriangle className="w-4 h-4" />
            <span>Connection Restored. Syncing...</span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>Offline: Changes will not be saved.</span>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
