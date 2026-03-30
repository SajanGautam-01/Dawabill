"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabaseClient";
import { format } from "date-fns";
import { Search, RotateCcw, Loader2 } from "lucide-react";

type BillRow = {
  id: string;
  bill_number: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
};

export default function RefundsAdminPage() {
  const { userRole, storeId } = useStore();
  const [bills, setBills] = useState<BillRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [response, setResponse] = useState<{ success?: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (userRole === "admin" && storeId) {
      fetchInvoices();
    }
  }, [userRole, storeId]);

  const fetchInvoices = async () => {
    setFetching(true);
    if (!storeId) {
      setFetching(false);
      return;
    }
    const { data, error } = await supabase
      .from('bills')
      .select('id, bill_number, total_amount, payment_status, created_at')
      .eq('store_id', storeId)
      .neq('payment_status', 'refunded')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (data) setBills(data);
    setFetching(false);
  };

  if (userRole !== "admin") {
    return <div className="p-8 text-red-600 font-bold bg-white rounded-xl shadow-sm m-12 text-center text-lg border border-red-100">Unauthorized Access</div>;
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredBills.map(b => b.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleBatchRefund = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: Array.from(selectedIds) }),
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        setResponse({ error: data.error || "Failed to process refunds." });
      } else {
        setResponse({ success: true });
        setSelectedIds(new Set());
        fetchInvoices(); // refresh UI to remove refunded items
      }
    } catch (err: any) {
      setResponse({ error: err.message || "Network error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = bills.filter(b => 
     b.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
     b.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAllSelected = filteredBills.length > 0 && selectedIds.size === filteredBills.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 mt-8 space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <RotateCcw className="text-red-500" size={28} /> Batch Refunds pipeline
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Select multiple invoices to forcefully reverse their transaction footprints atomically reconstructing inventory allocations dynamically safely locally.</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200 shadow-inner">
           <Button variant="outline" className="border-none bg-white text-slate-700 font-bold shadow-sm" onClick={fetchInvoices}>
              Refresh List
           </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
           <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
              <Input 
                placeholder="Search Bill Number or UUID..." 
                className="pl-10 h-12 rounded-xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
           </div>
           
           <div className="w-full md:w-auto flex items-center gap-4">
             {selectedIds.size > 0 && (
               <span className="font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 text-sm">
                 {selectedIds.size} Selected
               </span>
             )}
             <Button
               onClick={handleBatchRefund}
               disabled={selectedIds.size === 0 || loading}
               className="w-full md:w-auto h-12 bg-red-600 hover:bg-red-700 text-white font-bold px-8 shadow-lg shadow-red-500/20 rounded-xl transition-all disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5"
             >
               {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <RotateCcw className="h-5 w-5 mr-2" />} 
               Execute Batch Refund
             </Button>
           </div>
        </div>

        {response?.success && (
          <div className="m-4 p-4 bg-emerald-50 border-emerald-200 text-emerald-800 rounded-xl flex flex-col font-medium border shadow-sm">
            <span className="font-bold text-emerald-900 mb-1">✅ Atomic Batch Deployed</span>
            Successfully reversed transactions securely and restocked global inventory thresholds natively!
          </div>
        )}
        
        {response?.error && (
          <div className="m-4 p-4 bg-red-50 border-red-200 text-red-800 rounded-xl border shadow-sm font-medium">
             <span className="font-bold text-red-900 block mb-1">❌ Structural Validation Failed</span>
             {response.error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-sm font-bold uppercase tracking-wider border-b-2 border-slate-200">
                <th className="p-4 pl-6 w-16 text-center">
                   <input 
                     type="checkbox" 
                     className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                     checked={isAllSelected}
                     onChange={(e) => handleSelectAll(e.target.checked)}
                     disabled={filteredBills.length === 0}
                   />
                </th>
                <th className="p-4 py-5">Bill / UUID</th>
                <th className="p-4 py-5 text-right">Amount</th>
                <th className="p-4 py-5 text-center">Status</th>
                <th className="p-4 pr-6 py-5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {fetching ? (
                <tr>
                   <td colSpan={5} className="p-12 text-center text-slate-400 font-bold bg-slate-50/50">
                     <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-slate-300" />
                     Extracting invoice data limits...
                   </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                 <tr>
                   <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                     No non-refunded bills extracted locally.
                   </td>
                 </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr key={b.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(b.id) ? 'bg-red-50/30' : ''}`}>
                    <td className="p-4 pl-6 text-center align-middle">
                      <input 
                         type="checkbox" 
                         className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer transition-all"
                         checked={selectedIds.has(b.id)}
                         onChange={(e) => handleSelectOne(b.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-base">{b.bill_number}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{b.id}</div>
                    </td>
                    <td className="p-4 text-right font-black text-slate-900 border-x-0 tracking-tight">
                      ₹{Number(b.total_amount).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {b.payment_status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right text-slate-500 font-medium whitespace-nowrap">
                      {format(new Date(b.created_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
