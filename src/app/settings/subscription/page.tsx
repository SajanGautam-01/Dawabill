"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Check, ArrowLeft, Zap, Shield, Rocket, AlertCircle, Loader2, LogOut, CheckCircle2, Info, Lock } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function SubscriptionPage() {
  const { storeId, loading: storeLoading } = useStore();
  const { checkSubscriptionSync, status: subStatus, isSyncing: isGuardSyncing } = useSubscriptionGuard();
  const router = useRouter();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [userMetadata, setUserMetadata] = useState<any>(null);
  const [dbPlans, setDbPlans] = useState<any[]>([]);
  const [syncAttempts, setSyncAttempts] = useState(0);
  const [isActivating, setIsActivating] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true';

  const plans = [
    {
      name: "Starter",
      monthlyPrice: 99,
      yearlyPrice: 950,
      description: "Basic features for small retail shops.",
      features: ["Up to 500 bills/month", "Basic Inventory", "Customer Records", "Email Support"],
      icon: <Zap className="text-teal-600" />,
      color: "border-slate-100",
      bestValue: false
    },
    {
      name: "Professional",
      monthlyPrice: 149,
      yearlyPrice: 1430,
      description: "Advanced tools for growing pharmacies.",
      features: ["Unlimited Bills", "Advanced Inventory", "Sales Analytics", "Multi-user Access", "Loyalty Program"],
      icon: <Rocket className="text-primary" />,
      color: "border-primary/20",
      bestValue: true
    },
    {
      name: "Enterprise",
      monthlyPrice: 199,
      yearlyPrice: 1910,
      description: "Maximum efficiency for large chains.",
      features: ["Smart Bill Scanning", "Multi-store Sync", "Full Analytics", "Priority Support", "API Access"],
      icon: <Shield className="text-emerald-600" />,
      color: "border-slate-100",
      bestValue: false
    }
  ];

  useEffect(() => {
    let isMounted = true;
    if (!storeId) return;

    const fetchSubAndUser = async () => {
      try {
        const { data: sub } = await supabase.from('subscriptions').select('*, plans(name)').eq('store_id', storeId).maybeSingle();
        const { data: { session } } = await supabase.auth.getSession();
        const { data: user } = await supabase.from('users').select('trial_used').eq('id', session?.user?.id).maybeSingle();
        const { data: plansList } = await supabase.from('plans').select('*');
        
        if (isMounted) {
          setCurrentSub(sub);
          setUserMetadata(user);
          if (plansList) setDbPlans(plansList);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      }
    };
    fetchSubAndUser();
    return () => { isMounted = false; };
  }, [storeId]);

  const startSyncLoop = async () => {
    setShowRecovery(false);
    let attempts = 0;
    const maxAttempts = 8;
    const delays = [500, 800, 1200, 1500, 2000, 2500, 3000, 4000];

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setIsActivating(false);
        setShowRecovery(true);
        toast("Verification is taking longer. Contact support if access is not restored.", "info");
        return;
      }

      const res = await checkSubscriptionSync();
      
      if (res?.status === 'active') {
        setIsActivating(false);
        setShowRecovery(false);
        toast("Subscription activated!", "success");
        setTimeout(() => router.push('/dashboard'), 1000);
        return;
      }

      attempts++;
      setSyncAttempts(attempts);
      setTimeout(poll, delays[attempts - 1] || 2000);
    };

    poll();
  };

  const handleManualRecovery = async () => {
    toast("Verifying with payment provider...", "info");
    const res = await checkSubscriptionSync();
    if (res?.status === 'active') {
      setShowRecovery(false);
      toast("Payment verified!", "success");
      setTimeout(() => router.push('/dashboard'), 1000);
    } else {
      toast("Could not verify. Refreshing page...", "error");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleActivatePlan = async (plan: any) => {
    if (!storeId) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    
    setLoadingPlan(plan.name);
    setShowRecovery(false);

    try {
      const dbPlan = dbPlans.find(p => p.name.toLowerCase().includes(plan.name.toLowerCase()));
      if (!dbPlan) throw new Error("Plan not found.");

      const isTrialEligible = !userMetadata?.trial_used && !currentSub;
      
      if (isTestingMode && isTrialEligible) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 15);

        const subPayload = {
          store_id: storeId,
          plan_id: dbPlan.id,
          status: 'active',
          expiry_date: expiryDate.toISOString(),
          last_payment_id: 'TRIAL_ACTIVATION',
        };

        const { error: upsertError } = await supabase
          .from('subscriptions')
          .upsert(subPayload, { onConflict: 'store_id' });

        if (upsertError) throw new Error(`Activation failed.`);

        await supabase.from('users').update({ trial_used: true }).eq('id', session.user.id);
        
        setIsActivating(true);
        startSyncLoop();
      } else {
        const amount = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
        
        const orderRes = await fetch('/api/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, storeId })
        });
        
        const orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.error || "Failed to initiate payment.");

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "DawaBill Pharmacy SaaS",
          description: `${plan.name} Plan (${billingCycle})`,
          order_id: orderData.order.id,
          handler: async function (response: any) {
            setIsActivating(true);
            toast("Success! Finalizing access...", "info");
            
            const verifyRes = await fetch('/api/razorpay/sub-verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan_id: dbPlan.id,
                billing_cycle: billingCycle,
                user_id: session.user.id
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
               startSyncLoop();
            } else {
               setIsActivating(false);
               setShowRecovery(true);
               toast("Fulfillment pending. Our team will verify manually.", "error");
            }
          },
          prefill: {
            name: session.user.email?.split('@')[0] || "User",
            email: session.user.email
          },
          theme: { color: "#0F766E" },
          modal: { ondismiss: () => setLoadingPlan(null) }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      toast(err.message || "Failed to activate plan.", "error");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <div className="view-container max-w-6xl mx-auto px-4 py-12 pb-24">
      <div className="flex justify-between items-center mb-12">
        <Link href="/settings" className="inline-flex items-center text-slate-500 hover:text-slate-900 font-bold transition-all px-4 py-2 hover:bg-slate-50 rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-600 font-bold transition-all hover:bg-red-50 rounded-xl">
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-tight">Subscription & <span className="text-primary italic">Billing</span></h1>
        <p className="text-xl text-slate-500 mt-4 font-medium max-w-2xl mx-auto italic">Power your business with medical-grade inventory and POS tools.</p>
        
        <div className="mt-10 flex items-center justify-center gap-4">
          <button 
            onClick={() => setBillingCycle('monthly')}
            className={`px-8 py-3 rounded-full font-bold text-sm transition-all border ${billingCycle === 'monthly' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-500 border-slate-200'}`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setBillingCycle('yearly')}
            className={`px-8 py-3 rounded-full font-bold text-sm relative transition-all border ${billingCycle === 'yearly' ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-500 border-slate-200'}`}
          >
            Yearly
            <span className="absolute -top-3 -right-6 bg-emerald-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold shadow-md">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {isActivating && (
        <Card className="mb-10 bg-primary/5 border-primary/20 rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-3 text-primary font-bold text-xl mb-2">
              <Loader2 className="animate-spin" />
              Verifying Payment...
            </div>
            <p className="text-slate-500 font-medium">Please wait while we sync your subscription (Attempt {syncAttempts}/8)</p>
          </CardContent>
        </Card>
      )}

      {showRecovery && (
        <Card className="mb-10 bg-amber-50 border-amber-200 rounded-3xl overflow-hidden shadow-sm">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-xl font-bold text-amber-900 mb-2">Activation Delayed</h3>
            <p className="text-amber-700 font-medium mb-8 max-w-md">Your payment was successful, but syncing is taking time. You can verify manually or refresh.</p>
            <Button 
              onClick={handleManualRecovery} 
              disabled={isGuardSyncing}
              className="px-8 h-12 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 shadow-md transition-all active:scale-95"
            >
              {isGuardSyncing ? <Loader2 className="animate-spin" /> : "Verify Payment Manually"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const matchedPlan = dbPlans.find(p => p.name.toLowerCase().includes(plan.name.toLowerCase()));
          const isActive = currentSub?.plans?.name === plan.name;

          return (
            <Card 
              key={plan.name} 
              className={cn(
                "rounded-3xl bg-white border transition-all hover:scale-[1.02] duration-300 flex flex-col relative",
                plan.color,
                isActive ? 'ring-4 ring-primary ring-offset-4' : 'shadow-xl shadow-slate-100'
              )}
            >
            {plan.bestValue && (
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl shadow-sm">
                Recommended
              </div>
            )}
            {isActive && (
              <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
                <CheckCircle2 size={12} /> Active Plan
              </div>
            )}
            <CardHeader className="p-10 pb-0">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100">
                {plan.icon}
              </div>
              <CardTitle className="text-3xl font-bold text-slate-900">{plan.name}</CardTitle>
              <CardDescription className="text-base font-medium text-slate-500 mt-2">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-10 flex-1">
              <div className="mb-10">
                <div className="flex items-end gap-1">
                   <span className="text-6xl font-bold text-slate-900 tracking-tighter">
                     ₹{billingCycle === 'monthly' ? plan.monthlyPrice : Math.floor(plan.yearlyPrice / 12)}
                   </span>
                   <span className="text-slate-400 font-bold mb-2 text-lg">/mo</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-emerald-600 text-xs font-bold mt-2 uppercase tracking-widest">
                    Billed ₹{plan.yearlyPrice} annually
                  </p>
                )}
              </div>
              <ul className="space-y-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-slate-600 font-bold text-sm">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="p-10 pt-0 mt-auto">
              <Button 
                disabled={loadingPlan !== null || storeLoading || isActivating || isActive}
                onClick={() => handleActivatePlan(plan)}
                className={cn(
                  "w-full h-14 rounded-2xl font-bold text-lg transition-all shadow-md active:scale-95",
                  isActive ? 'bg-emerald-50 text-emerald-700 cursor-default border-emerald-100' : 
                  plan.bestValue ? 'bg-primary hover:bg-primary/90 text-white' : 'bg-slate-900 hover:bg-black text-white'
                )}
              >
                {loadingPlan === plan.name ? (
                  <Loader2 className="animate-spin h-6 w-6" />
                ) : (
                  isActive ? "Plan Active" : 
                  isTestingMode ? (
                    (userMetadata?.trial_used || currentSub) ? `Choose ${plan.name}` : "Start 15-Day Trial"
                  ) : "Select Plan"
                )}
              </Button>
            </CardFooter>
          </Card>
          );
        })}
      </div>

      <Card className="mt-20 border-2 border-dashed border-slate-200 bg-slate-50/30 rounded-[48px] overflow-hidden">
        <CardContent className="p-16 text-center max-w-3xl mx-auto">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-8">
             <Shield size={32} />
          </div>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Enterprise Solutions</h3>
          <p className="text-slate-500 font-medium mt-4 text-lg leading-relaxed">
            Need a custom solution for your pharmacy chain? We offer multi-store sync, custom SLAs, and 24/7 dedicated support.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
             <Button variant="outline" className="h-12 px-8 rounded-xl font-bold border-slate-300 text-slate-700 bg-white" onClick={() => router.push('/support')}>
               Talk to Support
             </Button>
             <Button className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-primary/10" onClick={() => router.push('/support')}>
               Contact Sales
             </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 flex items-center justify-center gap-6 text-slate-400 text-xs font-bold uppercase tracking-widest">
         <div className="flex items-center gap-2"><Lock size={14} /> Secure Payments</div>
         <div className="w-1 h-1 rounded-full bg-slate-200" />
         <div className="flex items-center gap-2"><Shield size={14} /> PCI Compliant</div>
         <div className="w-1 h-1 rounded-full bg-slate-200" />
         <div className="flex items-center gap-2"><Info size={14} /> 24/7 Support</div>
      </div>
    </div>
  );
}
