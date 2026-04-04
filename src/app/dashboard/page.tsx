"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import dynamic from 'next/dynamic';
import { 
  AlertCircle, 
  TrendingUp, 
  IndianRupee, 
  Clock, 
  ArrowUpRight,
  ShoppingCart,
  BarChart3,
  Box,
  FileSearch,
  ShieldCheck,
  Package,
  Activity
} from "lucide-react";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const SalesLineChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.SalesLineChart), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-[250px] rounded-xl" /> 
});
const TopProductsPieChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.TopProductsPieChart), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-[250px] rounded-xl" /> 
});
const MonthlyRevenueBarChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.MonthlyRevenueBarChart), { 
  ssr: false, 
  loading: () => <Skeleton className="w-full h-[250px] rounded-xl" /> 
});

export default function DashboardAnalytics() {
  const { storeId, loading: storeLoading } = useStore();
  const [loading, setLoading] = useState(true);

  const [dailySales, setDailySales] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  
  const [showCharts, setShowCharts] = useState(false);
  useEffect(() => {
    setShowCharts(true);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);

    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, expiry_date')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (products) {
        const low = products.filter(p => p.stock_quantity <= 10).sort((a,b) => a.stock_quantity - b.stock_quantity).slice(0, 5);
        setLowStock(low);
        
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const exp = products.filter(p => p.expiry_date && new Date(p.expiry_date) <= thirtyDaysFromNow)
                            .sort((a,b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
                            .slice(0, 5);
        setExpiring(exp);
      }

      const { data: revStats } = await supabase.rpc('get_revenue_stats', { p_store_id: storeId, p_days: 30 });
      if (revStats) {
        setDailySales(revStats.map((r: any) => ({ name: r.date, sales: Number(r.revenue) })));
      }

      const sixMonthsAgo = subDays(new Date(), 180).toISOString();
      const { data: monthlyStats } = await supabase
          .from('bills')
          .select('total_amount, created_at')
          .eq('store_id', storeId)
          .gte('created_at', sixMonthsAgo);

      if (monthlyStats) {
          const monthlyMap: Record<string, number> = {};
          monthlyStats.forEach(b => {
              const mStr = format(new Date(b.created_at), 'MMM yyyy');
              monthlyMap[mStr] = (monthlyMap[mStr] || 0) + Number(b.total_amount);
          });
          const sortedMonths = Object.keys(monthlyMap); 
          setMonthlyRevenue(sortedMonths.map(m => ({ name: m, revenue: monthlyMap[m] })));
      }

      const { data: topProductsData } = await supabase.rpc('get_top_selling_products', { p_store_id: storeId, p_limit: 5 });
      if (topProductsData) {
        setTopProducts(topProductsData);
      }

    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      if (!storeLoading) setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [storeId, storeLoading, fetchDashboardData]);

  if (storeLoading || (loading && !dailySales.length)) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-[400px] rounded-2xl" />
          <Skeleton className="h-[400px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const totalRevenue = monthlyRevenue.reduce((acc, curr) => acc + curr.revenue, 0);
  const weekSales = dailySales.reduce((acc, curr) => acc + curr.sales, 0);

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
            <Activity size={12} /> System Active & Secure
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Pharmacy <span className="text-primary italic">Overview</span></h1>
          <p className="text-slate-500 font-medium">Track your daily sales, inventory levels, and business growth.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/billing">
            <Button size="lg" className="h-12 px-6 rounded-xl gap-2 font-bold text-sm shadow-md active:scale-95 transition-all">
              <ShoppingCart size={18} />
              New Bill
            </Button>
          </Link>
          <Link href="/ocr">
            <Button variant="outline" size="lg" className="h-12 px-6 rounded-xl gap-2 font-bold text-sm border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">
              <Package size={18} />
              Stock Scan
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KEY STATS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="group border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all bg-white">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/5">
                <IndianRupee size={24} />
              </div>
              <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-100 font-bold uppercase tracking-widest text-[9px]">Monthly</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
              <h3 className="text-3xl font-bold text-slate-900">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="group border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all bg-white">
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/5">
                <TrendingUp size={24} />
              </div>
              <Badge variant="outline" className="text-primary bg-primary/5 border-primary/10 font-bold uppercase tracking-widest text-[9px]">Weekly</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sales Flow</p>
              <h3 className="text-3xl font-bold text-slate-900">₹{weekSales.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "group border-slate-200 shadow-sm rounded-2xl hover:shadow-md transition-all bg-white",
          lowStock.length > 0 && "border-amber-200 bg-amber-50/20"
        )}>
          <CardContent className="p-8">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border ", lowStock.length > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/10" : "bg-slate-100 text-slate-400 border-slate-200")}>
                <AlertCircle size={24} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Inventory Alerts</p>
              <h3 className={cn("text-3xl font-bold text-slate-900", lowStock.length > 0 && "text-amber-600")}>
                {lowStock.length} <span className="text-lg font-medium tracking-normal text-slate-400">Items</span>
              </h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CHARTS ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="p-8 border-b border-slate-50">
            <CardTitle className="text-xl font-bold text-slate-900">Revenue Trend</CardTitle>
            <CardDescription className="text-sm font-medium">Daily performance for the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px] relative">
               {showCharts ? (
                 dailySales.length > 0 ? (
                    <SalesLineChart data={dailySales} />
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <FileSearch size={40} className="text-slate-300 mb-4" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Sales Data Yet</p>
                    </div>
                 )
               ) : <Skeleton className="h-full w-full rounded-xl" />}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="p-8 border-b border-slate-50">
            <CardTitle className="text-xl font-bold text-slate-900">Top Medicines</CardTitle>
            <CardDescription className="text-sm font-medium">Best selling items by quantity.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px]">
              {showCharts ? (
                topProducts.length > 0 ? (
                  <TopProductsPieChart data={topProducts} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <Box size={40} className="text-slate-300 mb-4" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Top Products</p>
                  </div>
                )
              ) : <Skeleton className="h-full w-full rounded-xl" />}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="p-8 border-b border-slate-50">
            <CardTitle className="text-2xl font-bold text-slate-900">Monthly Growth</CardTitle>
            <CardDescription className="text-sm font-medium">Revenue comparison over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pb-12">
            <div className="h-[320px]">
              {showCharts ? (
                monthlyRevenue.length > 0 ? (
                   <MonthlyRevenueBarChart data={monthlyRevenue} />
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <BarChart3 size={48} className="text-slate-300 mb-6" />
                      <h4 className="text-lg font-bold text-slate-900 mb-1">No Monthly Data</h4>
                      <p className="text-xs font-medium text-slate-500 max-w-xs">
                        Start <Link href="/billing" className="text-primary hover:underline underline-offset-4">billing items</Link> to see your monthly growth charts.
                      </p>
                   </div>
                )
              ) : <Skeleton className="h-full w-full rounded-xl" />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ALERTS ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
        <div className="space-y-4">
           <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 px-1">
             <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                <AlertCircle size={18} />
             </div>
             Low Stock Alerts
           </h2>
          
           {lowStock.length > 0 ? (
             <div className="grid grid-cols-1 gap-3">
               {lowStock.map((p) => (
                 <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 p-5 rounded-xl hover:border-red-200 transition-all shadow-sm">
                   <div className="flex flex-col">
                     <span className="font-bold text-slate-900">{p.name}</span>
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {p.id.split('-')[0]}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Qty</span>
                         <span className="text-lg font-bold text-red-600 leading-none">{p.stock_quantity}</span>
                      </div>
                      <div className="w-1 h-8 rounded-full bg-red-100 overflow-hidden">
                         <div className="bg-red-500 h-1/4 animate-pulse" />
                      </div>
                   </div>
                 </div>
               ))}
             </div>
           ) : (
             <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center flex flex-col items-center">
               <ShieldCheck size={32} className="text-emerald-500/20 mb-3" />
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Stock Levels Good</p>
             </div>
           )}
        </div>

        <div className="space-y-4">
           <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 px-1">
             <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <Clock size={18} />
             </div>
             Expiring Soon
           </h2>

           {expiring.length > 0 ? (
             <div className="grid grid-cols-1 gap-3">
               {expiring.map((p) => {
                 const isExpired = new Date(p.expiry_date) < new Date();
                 return (
                   <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 p-5 rounded-xl hover:border-amber-200 transition-all shadow-sm">
                     <div className="flex flex-col">
                       <span className="font-bold text-slate-900">{p.name}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiry: {format(new Date(p.expiry_date), 'dd MMM yyyy')}</span>
                     </div>
                     <Badge variant={isExpired ? "destructive" : "amber"} className="px-3 py-1 font-bold uppercase tracking-widest text-[8px]">
                       {isExpired ? 'Expired' : 'Soon'}
                     </Badge>
                   </div>
                 );
               })}
             </div>
           ) : (
             <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-12 text-center flex flex-col items-center">
               <ShieldCheck size={32} className="text-primary/20 mb-3" />
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Expiry Issues</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
