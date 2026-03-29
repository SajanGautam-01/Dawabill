"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Optionally check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    
    // Clear prompt 
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 bg-white border border-gray-200 shadow-2xl rounded-xl p-4 z-50 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
          <span className="text-white font-bold text-sm">DB</span>
        </div>
        <div className="flex flex-col">
          <h4 className="font-semibold text-gray-900 text-sm">Install DawaBill</h4>
          <span className="text-xs text-gray-500">Fast & offline access</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        <Button size="sm" onClick={handleInstallClick} className="w-full text-xs h-8">
          Install App
        </Button>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-[10px] text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
