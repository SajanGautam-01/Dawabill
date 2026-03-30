"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { 
  Building2, Users, ReceiptIndianRupee, CreditCard, 
  LifeBuoy, ShieldAlert, Loader2, CheckCircle, XCircle,
  ChevronLeft, ChevronRight
} from "lucide-react";

export default function SuperAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [activeTab, setActiveTab] = useState("overview");
  
  // Data States
  const [stats, setStats] = useState({ stores: 0, revenue: 0, activeSubs: 0, expiredSubs: 0 });
  const [stores, setStores] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    
    // Initial fetch for overview & stats only
    const { data: statsStores } = await supabase.from("stores").select("subscriptions(status, expiry_date)");
    
    // Fetch Tickets
    const { data: ticketsData } = await supabase.from("support_tickets").select("*, stores(name)").order("created_at", { ascending: false });
    if (ticketsData) setTickets(ticketsData);

    // Compute Global Stats
    if (statsStores) {
      let active = 0;
      let expired = 0;
      statsStores.forEach(s => {
        const sub = s.subscriptions?.[0];
        if (sub) {
          if (new Date(sub.expiry_date) > new Date()) active++;
          else expired++;
        }
      });
      setStats({
        stores: statsStores.length,
        revenue: 450000, 
        activeSubs: active,
        expiredSubs: expired
      });
    }

    setLoading(false);
  }, []);

  const checkSuperAdminAccess = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/auth/login");
      return;
    }

    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (user?.role !== "super_admin") {
      // Security: Block all others
      router.push("/dashboard");
      return;
    }

    setIsAdmin(true);
    fetchAllData();
  }, [router, fetchAllData]);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE - 1;

    // Utilize optimized range function for scalable fetching
    const { data: storesData, count } = await supabase
      .from("stores")
      .select("*, users(name, email), subscriptions(status, expiry_date, plans(name))", { count: "exact" })
      .order('created_at', { ascending: false })
      .range(start, end);

    if (storesData) setStores(storesData);
    if (count) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE) || 1);
    
    setLoading(false);
  }, [currentPage]);

  useEffect(() => {
    checkSuperAdminAccess();
  }, [checkSuperAdminAccess]);

  // Fetch paginated stores when tab mounts or page changes
  useEffect(() => {
    if (isAdmin && activeTab === 'stores') {
      fetchStores();
    }
  }, [currentPage, activeTab, isAdmin, fetchStores]);

  // --- ACTIONS ---
  
  const toggleStoreStatus = async (storeId: string, currentStatus: string) => {
    const newDate = currentStatus === 'active' ? new Date(0).toISOString() : new Date(Date.now() + 30*24*60*60*1000).toISOString();
    
    await supabase.from("subscriptions").update({ expiry_date: newDate, status: currentStatus === 'active' ? 'expired' : 'active' }).eq("store_id", storeId);
    
    fetchStores(); // Refresh current page
    fetchAllData(); // Refresh global stats
  };

  const extendSubscription = async (storeId: string, days: number) => {
    const store = stores.find(s => s.id === storeId);
    const sub = store?.subscriptions?.[0];
    if (!sub) return alert("No subscription found for this store.");
    
    const newExpiry = new Date(new Date(sub.expiry_date).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("subscriptions").update({ expiry_date: newExpiry, status: 'active' }).eq("store_id", storeId);
    
    fetchStores(); // Refresh current page
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
    fetchAllData();
  };

  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-500 h-8 w-8" /></div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex pb-20 font-sans">
      
      {/* Sidebar - Hidden Admin */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 p-6 flex flex-col gap-6">
        <div className="flex items-center gap-3 text-red-500 font-black text-xl tracking-wider">
          <ShieldAlert /> GOD MODE
        </div>
        <nav className="flex flex-col gap-2 mt-8">
          <button onClick={() => setActiveTab('overview')} className={`p-3 text-left rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>Overview</button>
          <button onClick={() => setActiveTab('stores')} className={`p-3 text-left rounded-lg transition-colors ${activeTab === 'stores' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>Store Manager</button>
          <button onClick={() => setActiveTab('tickets')} className={`p-3 text-left rounded-lg transition-colors ${activeTab === 'tickets' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>Support Desk</button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-red-500 h-8 w-8" /></div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
            
            {activeTab === 'overview' && (
              <>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">System Overview</h1>
                  <p className="text-slate-400 mt-1">Real-time metrics for all DawaBill tenants.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="Total Stores" value={stats.stores} icon={<Building2 className="text-blue-400"/>} />
                  <StatCard title="Total Revenue" value={`₹${stats.revenue.toLocaleString()}`} icon={<ReceiptIndianRupee className="text-emerald-400"/>} />
                  <StatCard title="Active Subs" value={stats.activeSubs} icon={<CheckCircle className="text-emerald-400"/>} />
                  <StatCard title="Expired Subs" value={stats.expiredSubs} icon={<XCircle className="text-red-400"/>} />
                </div>
              </>
            )}

            {activeTab === 'stores' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Store Management</h1>
                  
                  {/* Paginator */}
                  <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 px-4 py-2 rounded-lg">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                      className="text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-semibold text-slate-300">
                      Page {currentPage} <span className="text-slate-500 font-normal">of {totalPages}</span>
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loading}
                      className="text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-4 font-semibold">Store Details</th>
                        <th className="p-4 font-semibold">Owner Info</th>
                        <th className="p-4 font-semibold">Plan & Status</th>
                        <th className="p-4 font-semibold">Created At</th>
                        <th className="p-4 font-semibold text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {stores.map(store => {
                        const sub = store.subscriptions?.[0];
                        const isActive = sub && new Date(sub.expiry_date) > new Date();
                        const owner = store.users?.[0];

                        return (
                          <tr key={store.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="p-4">
                              <p className="font-semibold text-slate-200">{store.name}</p>
                              <p className="text-xs text-slate-500 font-mono mt-1">{store.id.split('-')[0]}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-slate-300">{owner?.name || 'No Owner'}</p>
                              <p className="text-xs text-slate-500">{owner?.email || 'N/A'}</p>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {isActive ? 'Active' : 'Expired'}
                              </span>
                              <p className="text-xs text-slate-400 mt-2">{sub?.plans?.name || 'No Plan'}</p>
                            </td>
                            <td className="p-4 text-slate-400 text-sm">
                              {new Date(store.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 flex gap-2 justify-end">
                              <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => extendSubscription(store.id, 30)}>
                                +30 Days
                              </Button>
                              <Button size="sm" variant="outline" className={`border-red-500/30 text-red-400 hover:bg-red-500/10`} onClick={() => toggleStoreStatus(store.id, isActive ? 'active' : 'expired')}>
                                {isActive ? 'Disable' : 'Activate'}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div className="space-y-6">
                <h1 className="text-2xl font-bold tracking-tight text-white">Support Tickets</h1>
                <div className="grid gap-4">
                  {tickets.map(ticket => (
                    <div key={ticket.id} className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex items-start justify-between group">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${ticket.status === 'open' ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>
                            {ticket.status}
                          </span>
                          <span className="text-slate-400 text-xs font-medium">From: {ticket.stores?.name}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-200">{ticket.subject}</h3>
                        <p className="text-slate-400 mt-2 text-sm max-w-3xl leading-relaxed">{ticket.description}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        {ticket.status === 'open' ? (
                          <Button size="sm" onClick={() => updateTicketStatus(ticket.id, 'resolved')} className="bg-emerald-600 hover:bg-emerald-700">Mark Resolved</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, 'open')} className="border-slate-700 text-slate-400">Reopen</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-blue-400 hover:bg-blue-500/10">Reply</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: any, icon: React.ReactNode }) {
  return (
    <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-lg relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform">{icon && <div className="scale-[4]">{icon}</div>}</div>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-slate-900 rounded-lg">{icon}</div>
        <h3 className="text-slate-400 font-medium">{title}</h3>
      </div>
      <p className="text-4xl font-black text-white">{value}</p>
    </div>
  )
}
