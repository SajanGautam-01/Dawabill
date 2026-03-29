"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Trash2, Plus, QrCode, Database, MessageSquare, Award, Tag, Bell, Settings2, Loader2 } from "lucide-react";
import BackupSection from "@/components/settings/BackupSection";
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
  const [whatsappKey, setWhatsappKey] = useState("");
  const [enableWhatsapp, setEnableWhatsapp] = useState(false);
  const [hasWhatsappKey, setHasWhatsappKey] = useState(false);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState("100");
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  useEffect(() => {
    if (storeId && !dataFetched) {
      fetchAccounts();
    }
  }, [storeId, dataFetched]);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('payment_accounts')
      .select('id, store_id, upi_id, display_name, is_active, is_default, created_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (data) setAccounts(data);

    // Secure Fetch Store Settings via Backend (Fixing Security Exposure)
    const res = await fetch(`/api/settings/whatsapp?storeId=${storeId}`);
    const resData = await res.json();

    if (resData.success) {
      setEnableWhatsapp(resData.data.enable_whatsapp_alerts);
      setLoyaltyThreshold(resData.data.config?.loyalty_threshold || "100");
      setHasWhatsappKey(resData.data.has_whatsapp_key);
      if (resData.data.has_whatsapp_key) {
        setWhatsappKey("********"); // Initial mask
      }
    }

    setDataFetched(true);
    setLoading(false);
  };

  const handleUpdateSettings = async () => {
    setIsUpdatingSettings(true);
    
    // Security: Only send the actual key if it was edited (otherwise we'd overwrite it with '********')
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
      alert("Settings updated successfully!");
      if (finalWhatsappKey) setHasWhatsappKey(true);
      setWhatsappKey("********");
    } else {
      alert("Error updating settings: " + resData.error);
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
      is_default: accounts.length === 0 // make default if it is the first one
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
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-in fade-in duration-200 px-4 sm:px-6">
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 mb-8">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">Settings</h1>
        <p className="text-base sm:text-lg text-slate-500 mt-2 font-medium">Manage your store configurations and payment methods.</p>
      </div>

      <Card className="rounded-3xl shadow-lg border border-slate-100 bg-white hover:shadow-xl transition-all duration-200">
        <CardHeader className="p-8 pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl">
          <CardTitle className="text-2xl font-black flex items-center gap-3 text-slate-800">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
               <QrCode size={20} strokeWidth={2.5}/> 
            </div>
            Payment Accounts (UPI)
          </CardTitle>
          <CardDescription className="text-base font-medium mt-1">Add UPI IDs to generate dynamic QR codes on your bills.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* List existing */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-slate-500 font-medium text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-slate-500 font-medium italic border-2 border-dashed border-slate-200 p-8 rounded-2xl text-center bg-slate-50">
                No UPI accounts added yet.
              </div>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex justify-between items-center p-5 border-2 border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 hover:shadow-md transition-all group bg-white">
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      {acc.display_name} 
                      {acc.is_default && <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-widest font-black shadow-inner">Default</span>}
                    </h4>
                    <p className="text-sm text-slate-500 font-mono mt-0.5 font-medium">{acc.upi_id}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(acc.id)} className="h-10 w-10 rounded-xl text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-all">
                    <Trash2 size={18} strokeWidth={2.5} />
                  </Button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddAccount} className="pt-6 border-t-2 border-dashed border-slate-200 flex flex-col sm:flex-row gap-5">
            <div className="flex-1 space-y-2">
              <Label htmlFor="display_name" className="text-sm font-bold text-slate-700">Display Name</Label>
              <Input 
                id="display_name" 
                placeholder="e.g. HDFC PhonePe" 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                className="h-14 rounded-2xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 text-base font-medium"
              />
            </div>
            <div className="flex-[2] space-y-2">
              <Label htmlFor="upi_id" className="text-sm font-bold text-slate-700">UPI ID <span className="text-red-500">*</span></Label>
              <Input 
                id="upi_id" 
                placeholder="e.g. storename@bank" 
                required 
                value={newUpi} 
                onChange={e => setNewUpi(e.target.value)} 
                className="h-14 rounded-2xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 text-base font-medium"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={isAdding || !newUpi} className="w-full sm:w-auto h-14 px-8 rounded-2xl font-bold text-base shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 transition-all text-white flex items-center gap-2">
                <Plus size={20} strokeWidth={2.5}/> {isAdding ? "Adding..." : "Add UPI"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Promotions Link */}
      <Link href="/settings/discounts">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 rounded-3xl shadow-lg border border-blue-500 hover:scale-[1.01] transition-transform cursor-pointer group flex items-center justify-between text-white mb-8">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Tag size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black">Manage Discounts</h2>
              <p className="text-blue-100 font-medium opacity-90">Create and track store-wide promotional offers.</p>
            </div>
          </div>
          <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/40 transition-colors">
            <Plus size={20} />
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* WhatsApp Integration */}
        <Card className="rounded-3xl shadow-lg border border-slate-100 bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                 <MessageSquare size={20} />
              </div>
              WhatsApp Alerts
            </CardTitle>
            <CardDescription className="font-medium">Configure automatic expiry & billing alerts.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold">WATI/Twilio API Key</Label>
              <Input 
                type="password"
                placeholder="Enter your messaging API key"
                value={whatsappKey}
                onChange={e => setWhatsappKey(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <Bell size={18} className="text-slate-400" />
                <span className="font-bold text-slate-700">Enable Automated Alerts</span>
              </div>
              <input 
                type="checkbox" 
                checked={enableWhatsapp}
                onChange={e => setEnableWhatsapp(e.target.checked)}
                className="w-10 h-5 bg-slate-200 rounded-full appearance-none checked:bg-green-500 transition-colors cursor-pointer relative after:content-[''] after:absolute after:top-1 after:left-1 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-all checked:after:left-6"
              />
            </div>
          </CardContent>
        </Card>

        {/* Loyalty Program */}
        <Card className="rounded-3xl shadow-lg border border-slate-100 bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                 <Award size={20} />
              </div>
              Loyalty Points
            </CardTitle>
            <CardDescription className="font-medium">Reward your regular customers.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-bold">1 Point Per (₹)</Label>
              <Input 
                type="number"
                placeholder="e.g. 100"
                value={loyaltyThreshold}
                onChange={e => setLoyaltyThreshold(e.target.value)}
                className="h-12 rounded-xl"
              />
              <p className="text-xs text-slate-400 font-medium italic">Example: ₹1000 spend = 10 points.</p>
            </div>
            <Button 
                onClick={handleUpdateSettings} 
                className="w-full h-12 rounded-xl font-bold bg-slate-900 hover:bg-black text-white"
                disabled={isUpdatingSettings}
            >
              {isUpdatingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings2 size={18} className="mr-2" />}
              Save Configuration
            </Button>
          </CardContent>
        </Card>
      </div>

      
      {/* Backup & Portability Section */}
      {storeId && <BackupSection storeId={storeId} />}
      
      {/* Additional Settings (Store Details, Invoice Prefix) can go here later */}
    </div>
  );
}
