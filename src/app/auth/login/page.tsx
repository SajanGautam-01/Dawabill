"use client";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthButton } from "@/components/auth/AuthButton";
import { InlineStatus, type AuthStatus } from "@/components/auth/InlineStatus";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Layout, Eye, EyeOff, Mail, Lock } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [pinMode, setPinMode] = useState(false);
  const [fastPin, setFastPin] = useState("");

  useEffect(() => {
    if (localStorage.getItem('dawabill_fast_pin')) {
       setPinMode(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        router.push('/dashboard');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("loading");
    setErrorMessage("");

    // 15-second Timeout Shield
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 15000)
    );

    try {
      const authPromise = supabase.auth.signInWithPassword({ email, password });
      
      const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any;

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setStatus("invalid_credentials");
        } else {
          setErrorMessage(error.message);
          setStatus("server_down");
        }
      } else if (data.session) {
        if (fastPin.length === 4) {
           localStorage.setItem('dawabill_fast_pin', 'true');
           localStorage.setItem('dawabill_fast_auth', btoa(`${fastPin}:${email}:${password}`));
        }
        setStatus("success");
        router.push("/dashboard");
      }
    } catch (err: any) {
      if (err.message === "TIMEOUT") {
        setStatus("timeout");
      } else {
        setStatus("offline");
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-400 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <AuthCard className="relative z-10">
        <div className="text-center mb-10">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 transform hover:rotate-3 transition-transform">
            <Layout className="text-white" size={28} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Welcome Back</h1>
          <p className="text-slate-500 font-semibold">Sign in to manage your medical store.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <InlineStatus status={status} message={errorMessage} className="mb-6" />

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="username webauthn"
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 pl-12 pr-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-bold text-slate-700">Password</label>
              <Link href="/auth/forgot-password" title="Forgot password?" className="text-sm font-bold text-blue-600 hover:text-blue-700">Forgot?</Link>
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                required
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                autoComplete="current-password webauthn"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 pl-12 pr-12 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {pinMode ? (
            <div className="space-y-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
               <label className="text-sm font-bold text-blue-800">Fast Login PIN</label>
               <input
                 type="password"
                 maxLength={4}
                 placeholder="Enter 4-digit PIN"
                 value={fastPin}
                 autoComplete="off"
                 onChange={(e) => {
                   const val = e.target.value.replace(/\D/g, '').slice(0,4);
                   setFastPin(val);
                   if (val.length === 4) {
                      const cached = localStorage.getItem('dawabill_fast_auth');
                      if (cached) {
                         try {
                           const dec = atob(cached).split(':');
                           if (dec[0] === val) {
                             setEmail(dec[1]);
                             setPassword(dec[2]);
                           } else {
                             setErrorMessage("Invalid Fast PIN.");
                           }
                         } catch {}
                      }
                   }
                 }}
                 className="w-full h-12 text-center tracking-[1em] font-black text-xl rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none"
               />
               <p className="text-xs text-blue-600 font-medium text-center">Set PIN or use to auto-fill</p>
            </div>
          ) : (
             <button type="button" onClick={() => setPinMode(true)} className="text-sm font-bold text-slate-500 hover:text-blue-600 block w-full text-right mt-2">
               Enable Fast PIN
             </button>
          )}

          <AuthButton type="submit" isLoading={status === 'loading'} className="mt-8">
            Sign In
          </AuthButton>

          <footer className="mt-10 text-center">
            <p className="text-slate-500 font-bold">
              Don't have an account? 
              <Link href="/auth/signup" className="text-blue-600 ml-2 hover:underline">Create One</Link>
            </p>
          </footer>
        </form>
      </AuthCard>
    </div>
  );
}
