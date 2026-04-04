"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Trash2, Plus, QrCode, Database, MessageSquare, Award, Tag, Bell, Settings2, Loader2, Smartphone, ShieldCheck, Download, RefreshCw, ChevronRight, Check } from "lucide-react";
import BackupSection from "@/components/settings/BackupSection";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type PaymentAccount = {
  id: string;
  upi_id: string;
  display_name: string;
  is_default: boolean;
};

export default function SettingsPage() {
  const { storeId } = useStore();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [dataFetched, setDataFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newUpi, setNewUpi] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Advanced Settings State
  const { toast } = useToast();
  const [whatsappKey, setWhatsappKey] = useState("");
  const [enableWhatsapp, setEnableWhatsapp] = useState(false);
  const [hasWhatsappKey, setHasWhatsappKey] = useState(false);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState("100");
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payment_accounts')
      .select('id, store_id, upi_id, display_name, is_active, is_default, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (data) setAccounts(data);

    const res = await fetch(`/api/settings/whatsapp?storeId=${storeId}`);
    const resData = await res.json();

    if (resData.success) {
      setEnableWhatsapp(resData.data.enable_whatsapp_alerts);
      setLoyaltyThreshold(resData.data.config?.loyalty_threshold || "100");
      setHasWhatsappKey(resData.data.has_whatsapp_key);
      if (resData.data.has_whatsapp_key) {
        setWhatsappKey("********"); 
      }
    }

    setDataFetched(true);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    if (storeId && !dataFetched) {
      fetchAccounts();
    }
  }, [storeId, dataFetched, fetchAccounts]);

  const handleUpdateSettings = async () => {
    setIsUpdatingSettings(true);
    
    const finalWhatsappKey = whatsappKey === "********" ? undefined : whatsappKey;

    const res = await fetch('/api/settings/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        whatsappKey: finalWhatsappKey,
        enableWhatsapp,
        loyaltyThreshold
      })
    });

    const resData = await res.json();

    if (resData.success) {
      toast("Settings updated successfully.", "success");
      if (finalWhatsappKey) setHasWhatsappKey(true);
      setWhatsappKey("********");
    } else {
      toast("Update failed: " + resData.error, "error");
    }
    setIsUpdatingSettings(false);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !newUpi) return;
    
    setIsAdding(true);
    const { error } = await supabase.from('payment_accounts').insert([{
      store_id: storeId,
      upi_id: newUpi,
      display_name: newName || 'Store UPI',
      is_default: accounts.length === 0 
    }]);

    setIsAdding(false);
    if (!error) {
      setNewUpi("");
      setNewName("");
      fetchAccounts();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('payment_accounts').delete().eq('id', id);
    fetchAccounts();
  };

  return (
    <div className="view-container space-y-12 pb-24 max-w-7xl mx-auto">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-primary bg-primary/5 border-primary/10 font-bold uppercase tracking-widest text-[9px]">Store Management</Badge>
            <Badge variant="outline" className="text-slate-500 bg-slate-50 border-slate-100 font-bold uppercase tracking-widest text-[9px]">Secure Access</Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">System <span className="text-primary italic">Settings</span></h1>
          <p className="text-slate-500 font-medium max-w-xl">
             Configure your pharmacy's payment methods, notifications, and customer loyalty rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        
        {/* Left Column: Payments & Backup */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Payment Methods Card */}
          <Card className="bg-white border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/30">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <QrCode size={22} />
                 </div>
                 <div>
                    <CardTitle className="text-2xl font-bold text-slate-900">Payment Accounts</CardTitle>
                    <CardDescription className="font-medium text-slate-500">Configure UPI IDs for billing and checkout.</CardDescription>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                       <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center space-y-2 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                       <Smartphone className="h-8 w-8 text-slate-300" />
                       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No UPI accounts linked</p>
                    </div>
                  ) : (
                    accounts.map((acc) => (
                      <motion.div 
                        key={acc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group flex items-center justify-between p-5 rounded-2xl bg-white border border-slate-100 hover:border-primary/30 transition-all shadow-sm shadow-slate-100/50"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-slate-900">{acc.display_name}</span>
                             {acc.is_default && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 px-2 py-0 h-5 text-[8px] font-bold uppercase">Default</Badge>}
                          </div>
                          <p className="text-sm font-mono text-primary font-bold">{acc.upi_id}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} className="h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                           <Trash2 size={16} />
                        </Button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              <form onSubmit={handleAddAccount} className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Account Name</Label>
                  <Input 
                    placeholder="e.g. Shop GPay" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:border-primary font-bold"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">UPI ID / VPA</Label>
                  <Input 
                    placeholder="pharmacy@upi" 
                    required 
                    value={newUpi} 
                    onChange={e => setNewUpi(e.target.value)} 
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:border-primary font-bold"
                  />
                </div>
                <div className="flex items-end">
                   <Button type="submit" disabled={isAdding || !newUpi} className="h-12 w-full rounded-xl font-bold gap-2 shadow-lg shadow-primary/10">
                      <Plus size={16} /> Add Method
                   </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Campaign Center Link */}
          <Link href="/settings/discounts" className="block group">
            <div className="relative overflow-hidden p-10 rounded-3xl bg-slate-900 text-white shadow-xl group-hover:bg-black transition-all">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Tag size={120} />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[9px] font-bold uppercase tracking-widest">Revenue Management</div>
                  <h2 className="text-3xl font-bold tracking-tight">Discounts & Offers</h2>
                  <p className="text-slate-400 font-medium italic">Configure seasonal markdowns and loyalty redemptions.</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md group-hover:bg-primary text-white transition-all shadow-lg">
                  <ChevronRight size={28} />
                </div>
              </div>
            </div>
          </Link>

          {/* Backup Section */}
          {storeId && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <BackupSection storeId={storeId} />
            </div>
          )}
        </div>

        {/* Right Column: Configs */}
        <div className="space-y-10">
           
           {/* WhatsApp Settings */}
           <Card className="bg-white border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <MessageSquare size={18} />
                   </div>
                   <CardTitle className="text-xl font-bold text-slate-900">Notifications</CardTitle>
                </div>
                <CardDescription className="font-medium text-slate-500 mt-1">Configure WhatsApp alert settings.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Gateway API Token</Label>
                  <Input 
                    type="password"
                    placeholder="Store Token"
                    value={whatsappKey}
                    onChange={e => setWhatsappKey(e.target.value)}
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold"
                  />
                </div>
                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900">Broadcast Service</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Alerts</p>
                  </div>
                  <button 
                    onClick={() => setEnableWhatsapp(!enableWhatsapp)}
                    className={cn(
                      "w-12 h-6 rounded-full p-1 transition-all",
                      enableWhatsapp ? "bg-primary" : "bg-slate-200"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full transition-all shadow-md",
                      enableWhatsapp ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </CardContent>
           </Card>

           {/* Loyalty Program */}
           <Card className="bg-white border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                      <Award size={18} />
                   </div>
                   <CardTitle className="text-xl font-bold text-slate-900">Loyalty Program</CardTitle>
                </div>
                <CardDescription className="font-medium text-slate-500 mt-1">Reward your regular customers.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest ml-1">Points Calculation</Label>
                  <div className="flex items-center gap-3">
                     <div className="flex-1 relative">
                        <Input 
                          type="number"
                          placeholder="100"
                          value={loyaltyThreshold}
                          onChange={e => setLoyaltyThreshold(e.target.value)}
                          className="h-12 rounded-xl bg-slate-50 border-slate-200 font-bold text-lg pl-8"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                     </div>
                     <Badge variant="outline" className="h-12 px-4 rounded-xl text-slate-500 border-slate-200 font-bold">/ 1 Pt</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 italic font-medium ml-1">Customers get 1 point for every ₹{loyaltyThreshold} spent.</p>
                </div>
                
                <Button 
                    onClick={handleUpdateSettings} 
                    className="w-full h-14 rounded-2xl font-bold text-base gap-3 shadow-lg shadow-primary/10 active:scale-95 transition-all"
                    disabled={isUpdatingSettings}
                >
                  {isUpdatingSettings ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check size={20} />}
                  Save All Changes
                </Button>
              </CardContent>
           </Card>

        </div>
      </div>
    </div>
  );
}
