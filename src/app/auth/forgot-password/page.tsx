"use client";
import React, { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";
import { InlineStatus, type AuthStatus } from "@/components/auth/InlineStatus";
import { supabase } from "@/lib/supabaseClient";
import { Layout, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
      });

      if (error) {
        setErrorMessage(error.message);
        setStatus("server_down");
      } else {
        setStatus("email_sent");
      }
    } catch (err) {
      setStatus("offline");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-400 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <AuthCard className="relative z-10">
        <div className="mb-8">
          <Link href="/auth/login" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            Back to Sign In
          </Link>
        </div>

        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/30">
            <Layout className="text-white" size={28} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Reset Password</h1>
          <p className="text-slate-500 font-semibold">We'll send you a link to get back in.</p>
        </div>

        <form onSubmit={handleResetRequest} className="space-y-6">
          <InlineStatus status={status} message={errorMessage} className="mb-6" />

          {status !== 'email_sent' ? (
            <React.Fragment>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={20} />
                  <input
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-amber-500 outline-none transition-all font-medium text-slate-900"
                  />
                </div>
              </div>

              <AuthButton type="submit" isLoading={status === 'loading'} className="mt-8 bg-amber-600 hover:bg-amber-700 shadow-amber-500/25">
                Send Reset Link
              </AuthButton>
            </React.Fragment>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-600 font-medium mb-8">
                If an account exists for {email}, you will receive a password reset link shortly.
              </p>
              <Link href="/auth/login">
                <AuthButton variant="outline">Back to Login</AuthButton>
              </Link>
            </div>
          )}
        </form>
      </AuthCard>
    </div>
  );
}
