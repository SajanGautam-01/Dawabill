"use client";
import React from "react";
import { AlertCircle, CheckCircle2, WifiOff, ServerCrash, Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type AuthStatus = 
  | 'idle' 
  | 'loading' 
  | 'success' 
  | 'invalid_credentials' 
  | 'offline' 
  | 'server_down' 
  | 'email_sent' 
  | 'session_expired'
  | 'timeout';

interface InlineStatusProps {
  status: AuthStatus;
  message?: string;
  className?: string;
}

export function InlineStatus({ status, message, className }: InlineStatusProps) {
  if (status === 'idle' || status === 'loading') return null;

  const config = {
    success: {
      bg: "bg-emerald-50 border-emerald-100",
      text: "text-emerald-800",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      defaultMsg: "Action completed successfully."
    },
    invalid_credentials: {
      bg: "bg-rose-50 border-rose-100",
      text: "text-rose-800",
      icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
      defaultMsg: "Invalid email or password. Please try again."
    },
    offline: {
      bg: "bg-amber-50 border-amber-100",
      text: "text-amber-800",
      icon: <WifiOff className="w-5 h-5 text-amber-600" />,
      defaultMsg: "No internet connection detected."
    },
    server_down: {
      bg: "bg-slate-50 border-slate-200",
      text: "text-slate-800",
      icon: <ServerCrash className="w-5 h-5 text-slate-600" />,
      defaultMsg: "Authentication server is unreachable."
    },
    email_sent: {
      bg: "bg-blue-50 border-blue-100",
      text: "text-blue-800",
      icon: <Mail className="w-5 h-5 text-blue-600" />,
      defaultMsg: "Verification link sent to your email."
    },
    session_expired: {
      bg: "bg-amber-50 border-amber-100",
      text: "text-amber-800",
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      defaultMsg: "Your session has expired. Please log in again."
    },
    timeout: {
      bg: "bg-orange-50 border-orange-100",
      text: "text-orange-800",
      icon: <Clock className="w-5 h-5 text-orange-600" />,
      defaultMsg: "Request timed out. Please try again."
    }
  };

  const current = config[status as keyof typeof config] || config.invalid_credentials;

  return (
    <div className={cn(
      "w-full p-4 rounded-2xl border flex items-start gap-3 animate-in slide-in-from-top-2 duration-300",
      current.bg,
      className
    )}>
      <div className="shrink-0 mt-0.5">{current.icon}</div>
      <div className={cn("text-sm font-semibold leading-relaxed", current.text)}>
        {message || current.defaultMsg}
      </div>
    </div>
  );
}
