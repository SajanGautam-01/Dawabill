"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, ArrowLeft, Zap, Shield, Rocket, AlertCircle, Loader2, LogOut } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";

export default function SubscriptionPage() {
  const { storeId, loading: storeLoading } = useStore();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true';

  const plans = [
    {
      name: "Starter",
      price: "₹499",
      description: "Perfect for small pharmacies.",
      features: ["Up to 500 bills/month", "Basic Inventory", "WhatsApp Alerts (Limited)", "Standard Support"],
      icon: <Zap className="text-blue-500" />,
      color: "border-blue-100",
      bestValue: false
    },
    {
      name: "Professional",
      price: "₹999",
      description: "Most popular for growing stores.",
      features: ["Unlimited Bills", "Advanced Inventory", "Full WhatsApp Integration", "Priority Support", "Loyalty Program"],
      icon: <Rocket className="text-indigo-600" />,
      color: "border-indigo-600 border-2",
      bestValue: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For chains and multi-store setups.",
      features: ["Multi-store Sync", "Custom Analytics", "API Access", "Dedicated Account Manager"],
      icon: <Shield className="text-emerald-500" />,
      color: "border-emerald-100",
      bestValue: false
    }
  ];

  const handleActivatePlan = async (plan: any) => {
    if (!storeId) {
      setToast({ message: "Store ID not found. Please log in again.", type: 'error' });
      return;
    }
    
    setLoadingPlan(plan.name);

    try {
      // In Testing Mode, we bypass Razorpay and update the DB directly
      if (isTestingMode) {
        console.log(`[TESTING_MODE] Activating ${plan.name} for store ${storeId}`);
        
        // 1. Get Plan ID from DB
        const { data: plansData } = await supabase.from('plans').select('id, name');
        const dbPlan = plansData?.find(p => p.name.toLowerCase().includes(plan.name.toLowerCase()));
        const dbPlanId = dbPlan?.id;

        // 2. Perform upsert on subscriptions
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year expiry

        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            store_id: storeId,
            plan_id: dbPlanId || '00000000-0000-0000-0000-000000000000', // fallback
            status: 'active',
            expiry_date: expiryDate.toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'store_id' });

        if (subError) throw subError;

        setToast({ message: `${plan.name} plan activated successfully! Redirecting...`, type: 'success' });
        
        // Instant unlock feedback
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        setToast({ message: "Production payments are disabled. Please use Testing Mode for QA.", type: 'info' });
      }
    } catch (err: any) {
      console.error("Activation Error:", err);
      setToast({ message: err.message || "Failed to activate plan.", type: 'error' });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-in fade-in duration-500 min-h-screen">
      
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Header with Navigation & Logout */}
      <div className="flex justify-between items-center mb-12">
        <Link href="/settings" className="inline-flex items-center text-slate-500 hover:text-slate-900 font-medium transition-colors group">
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Settings
        </Link>
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-600 font-bold transition-all hover:bg-red-50 rounded-xl"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-tight">Upgrade Your <span className="text-indigo-600">Pharmacy</span></h1>
        <p className="text-xl text-slate-500 mt-4 font-medium max-w-2xl mx-auto">Instant activation. No credit card required during testing mode.</p>
      </div>

      {isTestingMode && (
        <div className="mb-12 bg-indigo-600 p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6 shadow-2xl shadow-indigo-500/30 text-white relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
             <Rocket size={120} />
          </div>
          <div className="bg-white/20 p-4 rounded-2xl">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-xl font-black uppercase tracking-widest text-indigo-100">QA Testing Mode Active</h3>
            <p className="text-indigo-50 font-medium mt-1">Free instant activation is enabled for all plans. Bypass Razorpay checkout for verification.</p>
          </div>
          <div className="md:ml-auto bg-white/10 px-4 py-2 rounded-xl border border-white/20 font-bold backdrop-blur-sm">
             STATUS: UNLOCKED
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <Card key={plan.name} className={`rounded-3xl shadow-xl bg-white overflow-hidden transition-all hover:scale-[1.02] duration-300 ${plan.color} relative flex flex-col`}>
            {plan.bestValue && (
              <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl shadow-sm">
                Best Value
              </div>
            )}
            <CardHeader className="p-8 pb-0">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                {plan.icon}
              </div>
              <CardTitle className="text-2xl font-black text-slate-900">{plan.name}</CardTitle>
              <CardDescription className="text-base font-medium text-slate-500 mt-2">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-8 flex-1">
              <div className="mb-8">
                <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                {plan.price !== "Custom" && <span className="text-slate-400 font-bold ml-2">/month</span>}
              </div>
              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-slate-600 font-medium">
                    <div className="mt-1 bg-emerald-100 text-emerald-600 rounded-full p-0.5 shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="p-8 pt-0 mt-auto">
              <Button 
                disabled={loadingPlan !== null || storeLoading}
                onClick={() => handleActivatePlan(plan)}
                className={`w-full h-14 rounded-2xl font-black text-base transition-all ${plan.bestValue ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 text-white shadow-xl' : 'bg-slate-900 hover:bg-black text-white'}`}
              >
                {loadingPlan === plan.name ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  plan.name === "Enterprise" ? "Free Trial Activation" : "Activate Plan"
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-16 text-center max-w-2xl mx-auto p-12 rounded-3xl border-4 border-dashed border-slate-100 bg-slate-50/50">
        <Shield size={40} className="mx-auto text-slate-300 mb-6" />
        <h3 className="text-xl font-black text-slate-800 tracking-tight">Enterprise Security & Compliance</h3>
        <p className="text-slate-500 font-medium mt-4 leading-relaxed">
          Need a custom solution for your pharmacy chain with multi-store sync and advanced analytics? 
        </p>
        <button type="button" onClick={() => router.push('/support')} className="text-indigo-600 font-bold mt-6 hover:underline text-lg">Chat with our experts</button>
      </div>
    </div>
  );
}
