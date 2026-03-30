"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent } from "@/components/ui/Card";
import { Users, Phone } from "lucide-react";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";

export default function CustomersPage() {
  const { storeId, userRole } = useStore();
  const { loading: subLoading } = useSubscriptionGuard();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId || userRole !== 'admin') return;

    const fetchCustomers = async () => {
      // We extract customers safely directly from the bills table to guarantee 0 changes to the POS save loops
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
          
          // Use the most recent name if it was empty initially
          if (b.customer_name && directory[phone].name === 'Unknown') directory[phone].name = b.customer_name;
          
          // Update last visit
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

  if (subLoading || loading) return <div className="p-12 text-center animate-pulse font-medium">Loading CRM data...</div>;
  if (userRole !== 'admin') return <div className="p-12 text-center text-red-500 font-bold">Unauthorized.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4 mt-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3"><Users size={28}/> Customer Directory</h1>
          <p className="text-slate-500 font-medium mt-1">Auto-generated customer records mapped directly from your live POS receipts safely.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {customers.map((c, i) => (
          <Card key={i} className="rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
            <CardContent className="p-6 text-center">
               <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center font-black text-xl mb-4 border border-indigo-100">
                 {c.name.charAt(0).toUpperCase()}
               </div>
               <h3 className="font-bold text-slate-800 truncate mb-1" title={c.name}>{c.name}</h3>
               <p className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1.5"><Phone size={12}/> {c.phone}</p>
               
               <div className="mt-6 flex justify-between items-center px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-left">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lifetime</p>
                     <p className="font-bold text-slate-700">₹{c.totalSpend.toFixed(0)}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="text-right">
                     <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Visits</p>
                     <p className="font-bold text-slate-700">{c.visits}</p>
                  </div>
               </div>
            </CardContent>
          </Card>
        ))}
        {customers.length === 0 && (
           <div className="col-span-full py-20 text-center text-slate-400 font-medium">No valid customer data has been attached to bills yet.</div>
        )}
      </div>
    </div>
  );
}
