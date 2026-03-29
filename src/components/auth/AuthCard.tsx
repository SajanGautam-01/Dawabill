"use client";
import React from "react";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'premium' | 'glass';
}

export function AuthCard({ children, className, variant = 'premium' }: AuthCardProps) {
  return (
    <div className={cn(
      "w-full max-w-md p-1 rounded-[2.5rem] bg-gradient-to-b from-blue-500/20 to-indigo-500/20 shadow-2xl backdrop-blur-3xl border border-white/20 transition-all duration-700 animate-in fade-in zoom-in-95",
      variant === 'glass' && "bg-white/70 border-slate-200/50",
      className
    )}>
      <div className="bg-white/95 backdrop-blur-md rounded-[2.25rem] p-8 md:p-10 shadow-inner border border-white/50">
        {children}
      </div>
    </div>
  );
}
