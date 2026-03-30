"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 className="text-emerald-500 h-5 w-5" />,
    error: <AlertCircle className="text-red-500 h-5 w-5" />,
    info: <Info className="text-blue-500 h-5 w-5" />
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200'
  };

  return (
    <div 
      role="alert" 
      aria-live="assertive" 
      aria-describedby="toast-message"
      className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl border-2 shadow-2xl transition-all duration-300 ${bgColors[type]} ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="shrink-0">{icons[type]}</div>
      <p id="toast-message" className="text-sm font-bold text-slate-800 pr-2">{message}</p>
      <button 
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="p-1 hover:bg-black/5 rounded-lg transition-colors text-slate-400"
      >
        <X size={16} />
      </button>
    </div>
  );
}
