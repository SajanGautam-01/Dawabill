"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  ArrowRight, 
  Pill, 
  ShieldCheck, 
  ReceiptIndianRupee, 
  Package, 
  Sparkles, 
  Lock, 
  Smartphone,
  Hospital,
  ClipboardCheck,
  LayoutDashboard,
  Users,
  CheckCircle2,
  ChevronRight,
  Stethoscope
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="min-h-screen bg-white selection:bg-primary/20 selection:text-primary overflow-x-hidden font-sans">
      
      {/* ── BACKGROUND AMBIENCE ────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-primary/[0.03] rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-100 rounded-full blur-[120px]" />
      </div>

      {/* ── NAVIGATION HEADER ─────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
               <Hospital className="text-white h-6 w-6 stroke-[2px]" />
            </div>
            <div className="flex flex-col">
               <span className="text-xl font-bold tracking-tight text-slate-900 leading-tight">Dawa<span className="text-primary italic">Bill</span></span>
               <span className="text-[10px] font-bold uppercase text-primary tracking-widest leading-none mt-0.5">Pharmacy POS</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-10 font-bold text-[11px] uppercase tracking-widest text-slate-400">
            <a href="#features" className="hover:text-primary transition-colors">Top Features</a>
            <a href="#security" className="hover:text-primary transition-colors">Security</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="hidden sm:block">
              <Button variant="ghost" className="font-bold text-xs uppercase tracking-widest text-slate-600">Merchant Login</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="h-11 px-6 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/10">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ──────────────────────────────────────────────────── */}
      <section className="relative pt-44 pb-32 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-slate-50 border border-slate-100 text-primary text-[10px] font-bold uppercase tracking-[0.2em] mb-12 shadow-sm"
          >
            <Sparkles size={14} className="animate-pulse" /> Finalists: Digital India SaaS 2024
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-8xl font-black tracking-tight max-w-5xl leading-[0.95] mb-10 text-slate-900"
          >
            The Smarter <span className="text-primary italic">Billing</span> Engine for Today's <span className="text-slate-400">Pharmacy</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-2xl text-slate-500 max-w-3xl font-medium mb-16 leading-relaxed"
          >
            Automated GST filing, precision stock tracing, and smart bill scanning. 
            Trusted by 500+ pharmacies across India.
          </motion.p>

          <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 0.8, delay: 0.3 }}
             className="flex flex-col sm:flex-row gap-6 w-full sm:w-auto"
          >
            <Link href="/auth/signup" className="w-full sm:w-auto">
              <Button size="lg" className="h-20 px-12 rounded-3xl font-bold text-xl gap-4 shadow-2xl shadow-primary/20 w-full active:scale-95 transition-all">
                Get Started Free <ArrowRight size={24} strokeWidth={2.5} />
              </Button>
            </Link>
            <Link href="https://wa.me/919876543210" target="_blank" className="w-full sm:w-auto">
              <Button variant="outline" className="h-20 px-12 rounded-3xl font-bold text-xl w-full border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                Book a Demo
              </Button>
            </Link>
          </motion.div>

          {/* ── APP PREVIEW MOCKUP ────────────────────────────────────────── */}
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.4 }}
            className="mt-28 relative w-full max-w-6xl mx-auto"
          >
            <div className="absolute inset-0 bg-primary/10 blur-[120px] opacity-10 -z-10" />
            <div className="rounded-[40px] border border-slate-100 bg-white p-5 shadow-[0_48px_80px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
               <div className="rounded-[24px] border border-slate-100 bg-slate-50 overflow-hidden aspect-[16/9] relative flex flex-col items-center justify-center p-12">
                  <div className="grid grid-cols-12 gap-6 w-full h-full opacity-40">
                     <div className="col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4">
                        <div className="w-full h-3 bg-slate-100 rounded-full" />
                        <div className="w-2/3 h-2 bg-slate-100/50 rounded-full" />
                        <div className="mt-auto flex flex-col gap-2">
                           <div className="w-full h-8 bg-primary/5 rounded-xl border border-primary/10" />
                           <div className="w-full h-8 bg-slate-50 rounded-xl" />
                        </div>
                     </div>
                     <div className="col-span-9 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
                        <div className="flex items-center justify-between mb-10">
                           <div className="w-48 h-6 bg-slate-50 rounded-full" />
                           <div className="flex gap-2">
                              <div className="w-20 h-8 bg-primary rounded-xl" />
                              <div className="w-8 h-8 bg-slate-50 rounded-xl" />
                           </div>
                        </div>
                        <div className="space-y-4">
                           <div className="w-full h-12 bg-slate-50 rounded-2xl" />
                           <div className="w-full h-12 bg-slate-50 rounded-2xl" />
                           <div className="w-full h-12 bg-slate-50 rounded-2xl" />
                        </div>
                     </div>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px]">
                     <Stethoscope size={64} className="text-primary mb-6 animate-pulse opacity-40" strokeWidth={1} />
                     <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Merchant Dashboard Interface</p>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── TRUST & COMPLIANCE ────────────────────────────────────────────── */}
      <section id="security" className="py-24 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6">
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 items-center opacity-40 transition-all">
              <div className="flex items-center gap-3 font-bold text-xl tracking-tight justify-center text-slate-900Gray">
                 <ShieldCheck className="text-primary" /> SUPABASE DATA
              </div>
              <div className="flex items-center gap-3 font-bold text-xl tracking-tight justify-center text-slate-900Gray">
                 <Lock className="text-primary" /> RAZORPAY SECURE
              </div>
              <div className="flex items-center gap-3 font-bold text-xl tracking-tight justify-center text-slate-900Gray">
                 <ClipboardCheck className="text-primary" /> GST READY
              </div>
              <div className="flex items-center gap-3 font-bold text-xl tracking-tight justify-center text-slate-900Gray">
                 <Smartphone className="text-primary" /> PWA ENABLED
              </div>
           </div>
        </div>
      </section>

      {/* ── FEATURE ANALYTICS ─────────────────────────────────────────────── */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 uppercase tracking-widest text-primary border-primary/20 bg-primary/5 font-bold">Standardized Pharmacy Tools</Badge>
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-24 text-slate-900">Everything your Shop Needs</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="group rounded-[40px] bg-white border border-slate-100 p-12 hover:border-primary/30 hover:shadow-xl transition-all text-left">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-8 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                <ReceiptIndianRupee size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Fast GST Billing</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Hyper-responsive POS interface built for India's high-traffic pharmacy counters. Prints GST bills in seconds.
              </p>
            </div>

            <div className="group rounded-[40px] bg-white border border-slate-100 p-12 hover:border-primary/30 hover:shadow-xl transition-all text-left">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-8 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                <Package size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">Stock Management</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Batch-level traceability with automatic stock alerts before items expire. Never lose money on expired stock again.
              </p>
            </div>

            <div className="group rounded-[40px] bg-white border border-slate-100 p-12 hover:border-primary/30 hover:shadow-xl transition-all text-left">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-8 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                <Smartphone size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900">WhatsApp Alerts</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                Send professional digital bills and loyalty points directly to your customers via WhatsApp. No printer required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-6">
         <div className="max-w-5xl mx-auto rounded-[60px] bg-primary p-12 md:p-24 text-center relative overflow-hidden shadow-2xl shadow-primary/20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/[0.04] blur-[80px] rounded-full -mr-48 -mt-48" />
            
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">Ready to Upgrade?</h2>
            <p className="text-primary-foreground/80 text-xl font-medium mb-12 max-w-2xl mx-auto">
              Unlock the full potential of your pharmacy today. No long-term contracts. Cancel anytime.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
               <Link href="/auth/signup" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="h-16 px-10 rounded-2xl font-bold text-lg text-primary w-full shadow-xl shadow-black/10">
                    Get Started Free
                  </Button>
               </Link>
               <Link href="/auth/login" className="w-full sm:w-auto">
                  <Button variant="ghost" className="h-16 px-10 rounded-2xl font-bold text-lg text-white hover:bg-white/10 w-full">
                    Partner Log In
                  </Button>
               </Link>
            </div>
         </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
           <div className="flex flex-col md:flex-row justify-between items-center gap-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                  <Hospital className="text-white h-5 w-5" />
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-900">DawaBill</span>
              </div>
              
              <div className="flex gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                 <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                 <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                 <a href="#" className="hover:text-primary transition-colors">Support</a>
              </div>
              
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                &copy; {new Date().getFullYear()} DawaBill Commerce Solutions
              </p>
           </div>
        </div>
      </footer>

    </main>
  );
}
