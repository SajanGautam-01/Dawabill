"use client";
import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function AuthButton({ 
  children, 
  isLoading, 
  variant = 'primary', 
  className, 
  disabled, 
  ...props 
}: AuthButtonProps) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25 active:scale-95",
    secondary: "bg-slate-900 text-white hover:bg-slate-800 active:scale-95",
    outline: "bg-transparent border-2 border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95",
  };

  return (
    <button
      disabled={isLoading || disabled}
      className={cn(
        "relative w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2 overflow-hidden",
        variants[variant],
        (isLoading || disabled) && "opacity-70 cursor-not-allowed active:scale-100",
        className
      )}
      {...props}
    >
      {isLoading ? (
        <React.Fragment>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing...</span>
        </React.Fragment>
      ) : (
        children
      )}
      
      {/* Premium Gloss Reflection */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
    </button>
  );
}
