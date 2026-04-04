"use client";

import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { CheckCircle2, AlertCircle, X, Info, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<{
  toast: (message: string, type?: ToastType) => void;
} | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

// ── PHASE 1: THE TOASTER HUB ───────────────────────────────────────────
export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-dismiss after 5s unless it's a loading state
    if (type !== "loading") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-0 right-0 z-[200] flex flex-col p-6 gap-3 md:max-w-[420px] w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem 
              key={t.id} 
              {...t} 
              onClose={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))} 
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// ── PHASE 2: THE STRIPE-STYLE TOAST CELL ───────────────────────────────
function ToastItem({ message, type, onClose }: Toast & { onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 className="text-emerald-500 h-5 w-5" />,
    error: <AlertCircle className="text-destructive h-5 w-5" />,
    info: <Info className="text-primary h-5 w-5" />,
    loading: <Loader2 className="text-primary h-5 w-5 animate-spin" />,
  };

  const colors = {
    success: "border-emerald-500/20 bg-emerald-500/[0.02]",
    error: "border-destructive/20 bg-destructive/[0.02]",
    info: "border-primary/20 bg-primary/[0.02]",
    loading: "border-primary/10 bg-slate-900",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={cn(
        "pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-[20px] border p-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-3xl transition-all group",
        colors[type] || "bg-card border-border"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 shrink-0">
          {icons[type]}
        </div>
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 leading-none">
                {type === 'loading' ? 'Processing' : 'System Message'}
             </span>
             {type === 'success' && <Sparkles size={10} className="text-emerald-500 animate-pulse" />}
          </div>
          <div className="text-sm font-bold tracking-tight text-foreground/90 leading-tight break-words">
            {message}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 -mr-1 -mt-1 h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground/30 hover:text-foreground hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* System Progress Bar (Auto-Diminishing) */}
      {type !== 'loading' && (
        <div className="absolute bottom-0 left-0 h-[2px] bg-white/5 w-full">
           <motion.div 
             initial={{ width: "100%" }}
             animate={{ width: "0%" }}
             transition={{ duration: 5, ease: "linear" }}
             className={cn(
               "h-full shadow-[0_0_8px_rgba(0,0,0,0.5)]",
               type === 'success' ? "bg-emerald-500" : type === 'error' ? "bg-destructive" : "bg-primary"
             )}
           />
        </div>
      )}
    </motion.div>
  );
}
