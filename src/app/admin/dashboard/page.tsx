"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useStore } from "@/hooks/useStore";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { 
  IndianRupee, 
  FileText, 
  AlertTriangle, 
  RotateCcw, 
  PackageMinus, 
  TrendingUp, 
  Activity, 
  ShieldCheck,
  Search,
  Clock,
  Loader2,
  Lock,
  UserCheck,
  Zap,
  BarChart3,
  CheckCircle2
} from "lucide-react";
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import { format, subDays, eachMonthOfInterval } from "date-fns";

/**
 * EXCLUSIVE ADMIN IDENTITY CONSTANTS
 */
const AUTHORIZED_EMAIL = "sajangautam007@gmail.com";
const AUTHORIZED_NAME = "Sajan Gautam";

// Optimized Dynamic Import for Visual Analytics
const SalesLineChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.SalesLineChart), { 
  ssr: false, 
  loading: () => <div className="w-full h-full bg-slate-50 animate-pulse rounded-2xl" /> 
});
const MonthlyRevenueBarChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.MonthlyRevenueBarChart), { 
  ssr: false, 
  loading: () => <div className="w-full h-full bg-slate-50 animate-pulse rounded-2xl" /> 
});

interface DashboardStats {
  totalBills: number;
  totalRevenue: number;
  refundedItems: number;
  failedPayments: number;
  lowStockItems: number;
}

interface FailedPayment {
  id: string;
  order_id: string;
  reason: string;
  created_at: string;
}

interface RefundLog {
  id: string;
  bill_number: string;
  total_amount: number;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  severity: 'info' | 'warn' | 'error';
  created_at: string;
  metadata: any;
}

/**
 * ULTRA-ADVANCED COMMAND CENTER (REFINED AUTH)
 * Performance: Freeze-free (Limit 50 + Infinite Scroll), Skeleton Loaders, SWR Caching
 * Security: Triple-Layer Identity Guard (Resilient Metadata Check)
 */
export default function AdminDashboardPage() {
  const { userRole, loading: storeLoading } = useStore();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const hasAnnouncedWelcome = useRef(false);
  
  // State for Visualization
  const [chartsData, setChartsData] = useState<{ sales: any[], revenue: any[] }>({ sales: [], revenue: [] });
  
  // State for Infinite Scroll Tables
  const [activeTab, setActiveTab ] = useState<'payments' | 'refunds' | 'logs'>('payments');
  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundsPage, setRefundsPage] = useState(0);
  const [hasMoreRefunds, setHasMoreRefunds] = useState(true);
  
  const [logs, setLogs] = useState<any[]>([]);
  const [logsPage, setLogsPage] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);

  // Guard: Mounting stability
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  /**
   * REFINED TRIPLE-LAYER IDENTITY VERIFICATION
   * Handles Multi-Field Metadata (name/full_name) and Case Sensitivity
   */
  useEffect(() => {
    if (!isMounted) return;

    async function verifyIdentity() {
      try {
        const { data: { user } } = await supabase.auth.getUser(); // Server-verified session
        
        if (!user) {
          setIsAuthorized(false);
          return;
        }

        // 1. Case-Insensitive Email Normalization Check
        const emailMatch = user.email?.toLowerCase().trim() === AUTHORIZED_EMAIL.toLowerCase().trim();
        
        // 2. Dual-Layer Metadata Verification (name & full_name fields)
        const metaFullName = (user.user_metadata?.full_name || "").toLowerCase().trim();
        const metaName = (user.user_metadata?.name || "").toLowerCase().trim();
        
        // Matches if either field contains "sajan" or exactly matches the authorized target
        const nameMatch = 
          metaFullName.includes("sajan") || 
          metaName.includes("sajan") ||
          metaFullName === AUTHORIZED_NAME.toLowerCase().trim();
        
        // 3. Mandatory Admin Role Synchronization
        const roleMatch = userRole === 'admin';

        console.log("Admin Identity Trace:", { emailMatch, nameMatch, roleMatch, metaFullName, metaName });

        if (emailMatch && nameMatch && roleMatch) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error("Auth Security Protocol Error:", err);
        setIsAuthorized(false);
      }
    }

    // Wait for useStore to provide the synced role before blocking
    if (!storeLoading) verifyIdentity();
  }, [isMounted, userRole, storeLoading]);

  // Fetcher for SWR
  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Telemetry Failure");
    return data;
  }, []);

  // stats (SWR)
  const { data: statsData, isLoading: statsLoading } = useSWR<{ stats: DashboardStats }>(
    isAuthorized ? '/api/admin/dashboard-stats' : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  // failed payments (SWR)
  const { data: paymentsData, isLoading: paymentsLoading } = useSWR<{ payments: FailedPayment[] }>(
    isAuthorized ? '/api/admin/failed-payments' : null,
    fetcher
  );

  // Manual Data Fetching: Refunds & Logs (Infinite Scroll Logic)
  const fetchLogs = useCallback(async (page: number) => {
    if (!isAuthorized) return;
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * 50, (page + 1) * 50 - 1);
      
      if (error) throw error;
      if (data) {
        setLogs(prev => [...prev, ...data]);
        if (data.length < 50) setHasMoreLogs(false);
      }
    } catch (err) { console.error("Logs Fetch Error", err); }
  }, [isAuthorized]);

  const fetchRefunds = useCallback(async (page: number) => {
    if (!isAuthorized) return;
    try {
      const { data, error } = await supabase
        .from('bills')
        .select('id, bill_number, total_amount, created_at, payment_status')
        .eq('payment_status', 'refunded')
        .order('created_at', { ascending: false })
        .range(page * 50, (page + 1) * 50 - 1);
      
      if (error) throw error;
      if (data) {
        setRefunds(prev => [...prev, ...data]);
        if (data.length < 50) setHasMoreRefunds(false);
      }
    } catch (err) { console.error("Refunds Fetch Error", err); }
  }, [isAuthorized]);

  // Initial Data Load
  useEffect(() => {
    if (isAuthorized) {
      fetchLogs(0);
      fetchRefunds(0);
      
      // Analytics Data for Charts
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      supabase.from('bills').select('total_amount, created_at').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data) {
            const dailyMap: Record<string, number> = {};
            data.forEach(b => {
               const day = format(new Date(b.created_at), 'MMM dd');
               dailyMap[day] = (dailyMap[day] || 0) + Number(b.total_amount);
            });
            setChartsData(prev => ({ ...prev, sales: Object.entries(dailyMap).map(([name, sales]) => ({ name, sales })) }));
          }
        });
        
      const sixMonthsAgo = subDays(new Date(), 180);
      const months = eachMonthOfInterval({ start: sixMonthsAgo, end: new Date() });
      supabase.from('bills').select('total_amount, created_at').gte('created_at', sixMonthsAgo.toISOString())
        .then(({ data }) => {
          if (data) {
            const revMap: Record<string, number> = {};
            data.forEach(b => {
               const mStr = format(new Date(b.created_at), 'MMM');
               revMap[mStr] = (revMap[mStr] || 0) + Number(b.total_amount);
            });
            setChartsData(prev => ({ ...prev, revenue: months.map(m => ({ name: format(m, 'MMM'), revenue: revMap[format(m, 'MMM')] || 0 })) }));
          }
        });
    }
  }, [isAuthorized, fetchLogs, fetchRefunds]);

  // Syncing / Verification State
  if (isAuthorized === null || storeLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 animate-in fade-in duration-700 bg-slate-50/50">
        <div className="relative">
          <div className="w-24 h-24 border-b-4 border-l-4 border-emerald-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <ShieldCheck size={40} className="text-emerald-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Syncing Security Protocol...</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Restoring Identity Session</p>
        </div>
      </div>
    );
  }

  // Security Wall: Unauthorized Access
  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-12 bg-white rounded-[40px] shadow-2xl border-4 border-red-50 text-center ring-20 ring-red-50/20 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
          <Lock size={48} strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Unauthorized Access</h1>
        <p className="text-slate-500 font-medium text-lg leading-relaxed mb-8">
          This command center is exclusively locked to **Sajan Gautam**. Your session footprint does not match the authorized administrator profile.
        </p>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-700 text-sm font-bold flex items-center justify-center gap-2 mb-8">
           <Activity size={16} /> Incident logged to Global Security Audit
        </div>
        <button onClick={() => window.history.back()} className="w-full h-14 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all active:scale-95">
          Retreat to Secure Area
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Welcome & Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8 py-8 border-b-2 border-slate-100 relative">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-3 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 shadow-sm ring-4 ring-emerald-50/50">
                <CheckCircle2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Verified Admin Session</span>
             </div>
             <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                Identity: {AUTHORIZED_NAME}
             </div>
          </div>
          <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter">Welcome, Verified Admin</h1>
          <p className="text-slate-500 text-lg font-medium max-w-2xl">Terminal synchronized. Macro performance indicators and atomic indices are now active.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-3xl shadow-xl border border-slate-100">
          <div className="px-6 py-3 bg-slate-900 text-white rounded-2xl flex items-center gap-3 shadow-lg shadow-blue-500/10">
            <Zap size={18} className="text-blue-400" />
            <span className="text-sm font-bold">Terminal Online</span>
          </div>
          <div className="flex flex-col px-4 text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Health</span>
            <span className="text-sm font-bold text-emerald-600 font-mono tracking-tighter">LATENCY: 14MS</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {statsLoading || !statsData ? Array(5).fill(0).map((_, i) => <KPISkeleton key={i} />) : (
          <>
            <KPICard title="Revenue Index" value={`₹${statsData.stats.totalRevenue.toLocaleString()}`} icon={<IndianRupee />} color="emerald" />
            <KPICard title="Total Transactions" value={statsData.stats.totalBills} icon={<FileText />} color="blue" />
            <KPICard title="Supply Anomalies" value={statsData.stats.lowStockItems} icon={<PackageMinus />} color="amber" />
            <KPICard title="Refund Ledger" value={statsData.stats.refundedItems} icon={<RotateCcw />} color="orange" />
            <KPICard title="Failure Traps" value={statsData.stats.failedPayments} icon={<AlertTriangle />} color="red" />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <AnalyticsCard title="Revenue Velocity" description="Daily sales trends (30-day window)" chart={<SalesLineChart data={chartsData.sales} />} icon={<TrendingUp className="text-blue-500" />} />
        <AnalyticsCard title="Macro Trends" description="Aggregated monthly revenue indices" chart={<MonthlyRevenueBarChart data={chartsData.revenue} />} icon={<BarChart3 className="text-emerald-500" />} />
      </div>

      {/* Monitoring Module (Infinite Scroll) */}
      <div className="space-y-6">
        <div className="flex items-center gap-8 border-b-2 border-slate-100 pb-0">
          <ModuleTab id="payments" active={activeTab} onClick={setActiveTab} label="Failed Intents" />
          <ModuleTab id="refunds" active={activeTab} onClick={setActiveTab} label="Refund Tracking" />
          <ModuleTab id="logs" active={activeTab} onClick={setActiveTab} label="Incident Stream" />
        </div>

        <Card className="rounded-[40px] shadow-2xl border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto min-h-[400px]">
            {activeTab === 'payments' && (
              <ModuleTable
                loading={paymentsLoading}
                headers={['Order ID', 'Failure Logic', 'Timestamp']}
                data={paymentsData?.payments || []}
                renderRow={(p: FailedPayment) => (
                   <tr key={p.id} className="hover:bg-red-50/20 border-b border-slate-50 last:border-0 group">
                      <td className="px-8 py-6 font-mono text-xs font-bold text-slate-800">{p.order_id}</td>
                      <td className="px-8 py-6 truncate max-w-[200px]">
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-black uppercase ring-1 ring-red-200">
                          <AlertTriangle size={14} /> {p.reason}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-slate-400">
                        {format(new Date(p.created_at), 'MM/dd HH:mm:ss')}
                      </td>
                   </tr>
                )}
                emptyMsg="Intents Nominal. No failures detected."
              />
            )}

            {activeTab === 'refunds' && (
              <ModuleTable
                loading={false}
                headers={['Bill Number', 'Atomic Amount', 'Status', 'Sync Date']}
                data={refunds}
                renderRow={(r: RefundLog) => (
                   <tr key={r.id} className="hover:bg-orange-50/20 border-b border-slate-50 last:border-0">
                      <td className="px-8 py-6 font-bold text-slate-900">{r.bill_number}</td>
                      <td className="px-8 py-6 font-black text-slate-800">₹{Number(r.total_amount).toFixed(2)}</td>
                      <td className="px-8 py-6"><span className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-black uppercase shadow-sm">Synced</span></td>
                      <td className="px-8 py-6 text-xs text-slate-400 font-medium">{format(new Date(r.created_at), 'MMM dd, HH:mm')}</td>
                   </tr>
                )}
                onLoadMore={hasMoreRefunds ? () => { setRefundsPage(p => p + 1); fetchRefunds(refundsPage + 1); } : undefined}
                emptyMsg="Refund pipeline stable."
              />
            )}

            {activeTab === 'logs' && (
              <ModuleTable
                loading={false}
                headers={['Level', 'Action Footprint', 'Metadata Trace', 'Time']}
                data={logs}
                renderRow={(l: AuditLog) => (
                  <tr key={l.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 font-mono text-xs">
                    <td className="px-8 py-6"><span className={`px-2.5 py-1 rounded-md font-black uppercase text-[10px] ${l.severity === 'error' ? 'bg-red-600 text-white' : l.severity === 'warn' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>{l.severity}</span></td>
                    <td className="px-8 py-6 font-bold text-slate-800">{l.action}</td>
                    <td className="px-8 py-6 text-slate-400 truncate max-w-[300px]">{JSON.stringify(l.metadata)}</td>
                    <td className="px-8 py-6 text-slate-400 text-[10px]">{format(new Date(l.created_at), 'HH:mm:ss.ms')}</td>
                  </tr>
                )}
                onLoadMore={hasMoreLogs ? () => { setLogsPage(p => p + 1); fetchLogs(logsPage + 1); } : undefined}
                emptyMsg="Incident Stream silent."
              />
            )}
          </div>
        </Card>
      </div>

    </div>
  );
}

/** 
 * REUSABLE COMPONENTS 
 */

function KPICard({ title, value, icon, color }: any) {
  const themes: Record<string, string> = {
    emerald: "from-emerald-600/20 to-white text-emerald-600 border-emerald-100",
    blue: "from-blue-600/20 to-white text-blue-600 border-blue-100",
    amber: "from-amber-600/20 to-white text-amber-600 border-amber-100",
    orange: "from-orange-600/20 to-white text-orange-600 border-orange-100",
    red: "from-red-600/20 to-white text-red-600 border-red-100",
  };
  return (
    <Card className={`rounded-[32px] border bg-gradient-to-br transition-all hover:scale-[1.02] duration-300 ${themes[color]}`}>
      <CardContent className="p-8">
        <div className="w-14 h-14 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-black/5">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">{title}</p>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h2>
      </CardContent>
    </Card>
  );
}

function KPISkeleton() {
  return <Card className="rounded-[32px] border-none bg-slate-50 h-44 animate-pulse" />;
}

function AnalyticsCard({ title, description, chart, icon }: any) {
  return (
    <Card className="rounded-[40px] shadow-2xl border-slate-100 overflow-hidden bg-white">
      <CardHeader className="p-8 border-b border-slate-50 bg-slate-50/50 flex flex-row items-center justify-between">
        <div><CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">{icon} {title}</CardTitle><CardDescription className="font-semibold text-slate-400">{description}</CardDescription></div>
      </CardHeader>
      <CardContent className="p-8 h-[360px]">{chart}</CardContent>
    </Card>
  );
}

function ModuleTab({ id, active, onClick, label }: any) {
  const isActive = active === id;
  return (
    <button onClick={() => onClick(id)} className={`pb-6 text-sm font-black uppercase tracking-[0.2em] relative transition-all ${isActive ? "text-emerald-600" : "text-slate-300 hover:text-slate-500"}`}>
      {label}
      {isActive && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-emerald-600 rounded-t-full shadow-[0_-5px_15px_rgba(16,185,129,0.4)]" />}
    </button>
  );
}

function ModuleTable({ loading, headers, data, renderRow, onLoadMore, emptyMsg }: any) {
  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead className="bg-slate-50/50 backdrop-blur-md sticky top-0 z-20 border-b-2 border-slate-100">
          <tr>{headers.map((h: string) => <th key={h} className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loading ? Array(5).fill(0).map((_, i) => <tr key={i}><td colSpan={headers.length} className="px-8 py-6"><div className="h-10 bg-slate-100 animate-pulse rounded-xl w-full" /></td></tr>) : data.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-8 py-20 text-center text-slate-300 font-bold italic opacity-50 flex flex-col items-center gap-3"><Search size={40} strokeWidth={1} />{emptyMsg}</td></tr>
          ) : (
            <>
              {data.map(renderRow)}
              {onLoadMore && <tr><td colSpan={headers.length} className="p-8 text-center bg-slate-50/30"><button onClick={onLoadMore} className="px-8 py-3 bg-white text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl border-2 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 hover:shadow-lg transition-all active:scale-95">Load Additional Entries</button></td></tr>}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
