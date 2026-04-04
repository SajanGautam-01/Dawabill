"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent } from "@/components/ui/Card";
import { Users, Phone, Loader2, ShieldAlert, User, TrendingUp, Calendar, Search, Filter } from "lucide-react";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function CustomersPage() {
  const { storeId, userRole } = useStore();
  const { loading: subLoading } = useSubscriptionGuard();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!storeId || userRole !== 'admin') return;

    const fetchCustomers = async () => {
      const { data: bills } = await supabase
        .from('bills')
        .select('customer_phone, customer_name, total_amount, created_at')
        .eq('store_id', storeId)
        .not('customer_phone', 'is', null);

      if (bills) {
        const directory: Record<string, any> = {};
        bills.forEach(b => {
          const phone = b.customer_phone?.trim();
          if (!phone || phone.length < 5) return;
          
          if (!directory[phone]) {
            directory[phone] = { phone, name: b.customer_name || 'Unknown', totalSpend: 0, visits: 0, lastVisit: b.created_at };
          }
          directory[phone].totalSpend += Number(b.total_amount);
          directory[phone].visits += 1;
          
          if (b.customer_name && directory[phone].name === 'Unknown') directory[phone].name = b.customer_name;
          
          if (new Date(b.created_at) > new Date(directory[phone].lastVisit)) {
            directory[phone].lastVisit = b.created_at;
          }
        });

        const sorted = Object.values(directory).sort((a,b) => b.totalSpend - a.totalSpend);
        setCustomers(sorted);
      }
      setLoading(false);
    };

    fetchCustomers();
  }, [storeId, userRole]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  if (subLoading || loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 animate-pulse">Loading Customer Records...</p>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mb-6">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Access Restricted</h2>
        <p className="text-slate-500 mb-10 max-w-md text-lg mx-auto font-medium">
          The Customer Directory is only available to store administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="view-container space-y-10 pb-20 max-w-7xl mx-auto">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-100 font-bold uppercase tracking-widest text-[9px]">Active Database</Badge>
            <Badge variant="outline" className="text-slate-500 bg-slate-50 border-slate-100 font-bold uppercase tracking-widest text-[9px]">Auto-Synced</Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Customer <span className="text-primary italic">Directory</span></h1>
          <p className="text-slate-500 font-medium max-w-xl">
             Manage profiles and transaction history for your pharmacy customers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input 
              placeholder="Search by name or mobile..." 
              className="pl-12 h-12 rounded-xl border-slate-200 focus:border-primary transition-all font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="hidden lg:flex items-center gap-4 px-6 py-3 bg-slate-50 rounded-xl border border-slate-100">
             <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Total Base</p>
                <p className="text-lg font-bold text-slate-900">{customers.length}</p>
             </div>
             <div className="w-px h-6 bg-slate-200" />
             <div className="text-center">
                <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Top Spenders</p>
                <p className="text-lg font-bold text-primary">{customers.filter(c => c.totalSpend > 5000).length}</p>
             </div>
          </div>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center space-y-4 text-slate-300">
          <Users className="h-16 w-16 opacity-20" />
          <p className="text-lg font-bold uppercase tracking-widest">No Records Found</p>
          <p className="text-xs font-medium italic">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredCustomers.map((c) => (
              <motion.div
                key={c.phone}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group"
              >
                <Card className="bg-white border-slate-200 rounded-2xl overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
                  <CardContent className="p-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="relative mb-6">
                        <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-3xl font-bold text-slate-400 group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/10 transition-all duration-300">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-primary">
                           <User size={14} />
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 mb-1 truncate w-full px-2 group-hover:text-primary transition-colors">{c.name}</h3>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-8 lowercase tracking-tight">
                         <Phone size={12} className="text-primary/50" /> {c.phone}
                      </div>

                      <div className="grid grid-cols-2 gap-4 w-full pt-6 border-t border-slate-50 mt-auto">
                        <div className="text-left">
                          <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mb-1">Total Spend</p>
                          <p className="text-lg font-bold text-slate-900 tracking-tight">₹{c.totalSpend.toFixed(0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mb-1">Visits</p>
                          <p className="text-lg font-bold text-slate-900 tracking-tight">{c.visits}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
