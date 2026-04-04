"use client";

import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";
import { InlineStatus, type AuthStatus } from "@/components/auth/InlineStatus";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Layout, Mail, Lock, User } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      // 1. PRE-CHECK: Duplicate Email Violation Check
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        setErrorMessage("This email already has an account. Please sign in instead.");
        setStatus("server_down");
        return;
      }

      // 2. Auth Signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setStatus("server_down");
      } else if (data.user && data.session === null) {
        // Confirmation email sent
        setStatus("email_sent");
      } else if (data.session) {
        setStatus("success");
        // Redirect handled by onAuthStateChange in layout or logic
      }
    } catch (err) {
      setStatus("offline");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-emerald-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <AuthCard className="relative z-10 transition-all duration-500">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/30">
            <Layout className="text-white" size={28} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Create Account</h1>
          <p className="text-slate-500 font-semibold">Start managing your store today.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
          <InlineStatus status={status} message={errorMessage} className="mb-6" />

          {/* Full Name Field */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
              <input
                required
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
              <input
                required
                type="password"
                placeholder="min. 6 characters"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-emerald-500 outline-none transition-all font-medium text-slate-900"
              />
            </div>
          </div>

          <AuthButton type="submit" isLoading={status === 'loading'} className="mt-8 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25">
            Create Store
          </AuthButton>

          <footer className="mt-10 text-center">
            <p className="text-slate-500 font-bold">
              Already have an account? 
              <Link href="/auth/login" className="text-emerald-600 ml-2 hover:underline">Sign In</Link>
            </p>
          </footer>
        </form>
      </AuthCard>
    </div>
  );
}
