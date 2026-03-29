"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import dynamic from 'next/dynamic';

const SalesLineChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.SalesLineChart), { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl" /> });
const TopProductsPieChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.TopProductsPieChart), { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl" /> });
const MonthlyRevenueBarChart = dynamic(() => import('@/components/dashboard/DashboardCharts').then(mod => mod.MonthlyRevenueBarChart), { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 animate-pulse rounded-2xl" /> });
import { AlertCircle, TrendingUp, Package, IndianRupee, Clock } from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardAnalytics() {
  const { storeId, loading: storeLoading } = useStore();
  const [loading, setLoading] = useState(true);

  const [dailySales, setDailySales] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  
  // Step 4 Fix: Heavy load delayed mount lock
  const [showCharts, setShowCharts] = useState(false);
  useEffect(() => {
    setShowCharts(true);
  }, []);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Fetch products for alerts (Low Stock & Expiring Soon)
      // Fix 1 & Fix 2: Minimal Data Fetch with Limits
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock_quantity, expiry_date')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(500); // 500 max limit to prevent payload bloat on alerts
      if (products) {
        // Low Stock
        const low = products.filter(p => p.stock_quantity <= 10).sort((a,b) => a.stock_quantity - b.stock_quantity).slice(0, 5);
        setLowStock(low);
        
        // Expiring
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const exp = products.filter(p => p.expiry_date && new Date(p.expiry_date) <= thirtyDaysFromNow)
                            .sort((a,b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())
                            .slice(0, 5);
        setExpiring(exp);
      }

      // 2. Fetch Aggregated Revenue Stats (Optimized Server-side)
      const { data: revStats } = await supabase.rpc('get_revenue_stats', { p_store_id: storeId, p_days: 30 });
      if (revStats) {
        setDailySales(revStats.map((r: any) => ({ name: r.date, sales: Number(r.revenue) })));
      }

      // Fetch all bills for pure Monthly view (Now also uses a more efficient query)
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
          const sortedMonths = Object.keys(monthlyMap).slice(-6); 
          setMonthlyRevenue(sortedMonths.map(m => ({ name: m, revenue: monthlyMap[m] })));
      }

      // 3. Top Products (Optimized Server-side Aggregation)
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

  if (storeLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Resolving store...</p>
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-6 max-w-md mx-auto text-center">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center shadow-inner">
          <AlertCircle size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">No store linked to your account</h2>
          <p className="text-slate-500 font-medium">Please contact your administrator or create a new store in settings.</p>
        </div>
        <div className="flex gap-4">
           {/* Add a CTA to settings or logout */}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium animate-pulse">Crunching numbers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
      
      {/* Top Header / Navbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">Dashboard Insights</h1>
          <p className="text-slate-500 mt-2 font-medium text-lg">Real-time performance for your medical store.</p>
        </div>
        <div className="mt-6 md:mt-0 px-6 py-3 bg-blue-50 text-blue-700 font-bold rounded-2xl border border-blue-100 shadow-inner flex items-center gap-2">
          Store ID: {storeId?.split('-')[0]}
        </div>
      </div>

      {/* Modern Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="rounded-3xl border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white">
          <CardContent className="p-8 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
              <IndianRupee size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Revenue</p>
              <h3 className="text-3xl font-black text-slate-900">₹{monthlyRevenue.reduce((acc, curr) => acc + curr.revenue, 0).toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-3xl border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white">
          <CardContent className="p-8 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0 shadow-inner">
              <TrendingUp size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Last 7 Days</p>
              <h3 className="text-3xl font-black text-slate-900">₹{dailySales.reduce((acc, curr) => acc + curr.sales, 0).toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-3xl border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white">
          <CardContent className="p-8 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle size={28} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Critical Stock</p>
              <h3 className="text-3xl font-black text-slate-900">{lowStock.length} Items</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Daily Sales Line Chart */}
        <Card className="rounded-3xl border border-slate-100 shadow-md hover:shadow-xl transition-all duration-200 bg-white overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800"><TrendingUp size={22} className="text-blue-600"/> Last 7 Days Sales</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
               {showCharts ? <SalesLineChart data={dailySales} /> : <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />}
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Products Pie Chart */}
        <Card className="rounded-3xl border border-slate-100 shadow-md hover:shadow-xl transition-all duration-200 bg-white overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800"><Package size={22} className="text-teal-500"/> Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
              {showCharts ? (
                topProducts.length > 0 ? (
                  <TopProductsPieChart data={topProducts} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">No sales data found. Generate bills to see products.</div>
                )
              ) : (
                 <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Revenue Bar Chart */}
        <Card className="rounded-3xl border border-slate-100 shadow-md hover:shadow-xl transition-all duration-200 bg-white overflow-hidden lg:col-span-2">
          <CardHeader className="p-6 border-b border-slate-100 bg-slate-50/80 backdrop-blur-md">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800"><IndianRupee size={22} className="text-emerald-500"/> Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[250px] w-full">
              {showCharts ? (
                monthlyRevenue.length > 0 ? (
                   <MonthlyRevenueBarChart data={monthlyRevenue} />
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-2xl">No revenue data yet.</div>
                )
              ) : (
                <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="rounded-3xl border border-red-100 shadow-md hover:shadow-xl transition-all duration-200 bg-white overflow-hidden">
          <CardHeader className="p-6 border-b border-red-50 bg-red-50/50 backdrop-blur-md">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-red-600"><AlertCircle size={22}/> Low Stock Alerts</CardTitle>
            <CardDescription className="text-red-500/80 font-medium">Products with 10 or fewer items remaining.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
             {lowStock.length > 0 ? (
               <div className="space-y-4">
                 {lowStock.map(p => (
                   <div key={p.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-red-200 transition-colors">
                     <span className="font-semibold text-slate-800 text-base">{p.name}</span>
                     <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-black tracking-wider shadow-inner">{p.stock_quantity} LEFT</span>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-slate-500 font-medium text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">Stock levels are healthy.</div>
             )}
          </CardContent>
        </Card>

        {/* Expiring Soon Alerts */}
        <Card className="rounded-3xl border border-amber-100 shadow-md hover:shadow-xl transition-all duration-200 bg-white overflow-hidden">
          <CardHeader className="p-6 border-b border-amber-50 bg-amber-50/50 backdrop-blur-md">
            <CardTitle className="text-xl font-bold flex items-center gap-3 text-amber-600"><Clock size={22}/> Expiring Soon</CardTitle>
            <CardDescription className="text-amber-600/80 font-medium">Medicines expiring within 30 days or expired.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
             {expiring.length > 0 ? (
               <div className="space-y-4">
                 {expiring.map(p => {
                   const isExpired = new Date(p.expiry_date) < new Date();
                   return (
                     <div key={p.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-amber-200 transition-colors">
                       <span className="font-semibold text-slate-800 text-base">{p.name}</span>
                       <span className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-wider shadow-inner ${isExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                         {isExpired ? 'EXPIRED' : new Date(p.expiry_date).toLocaleDateString()}
                       </span>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="text-slate-500 font-medium text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">No items expiring soon.</div>
             )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
