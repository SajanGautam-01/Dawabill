import { useStore } from "@/hooks/useStore";
import { useFinancialAnalytics } from "@/hooks/useFinancialAnalytics";
import { RevenueCard } from "./RevenueCard";
import dynamic from "next/dynamic";
const PaymentSplitChart = dynamic(() => import("./PaymentSplitChart").then(mod => mod.PaymentSplitChart), { ssr: false, loading: () => <div className="w-full h-full min-h-[300px] bg-slate-100 animate-pulse rounded-3xl" /> });
import { TrendingUp, Activity, BadgePercent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { useState, useEffect } from "react";

export function FinancialDashboard() {
  const { storeId } = useStore();
  const { 
    lifetimeRevenue, 
    monthlyRevenue, 
    todayRevenue, 
    estimatedProfit, 
    paymentSplit, 
    loading 
  } = useFinancialAnalytics(storeId);

  const [showChart, setShowChart] = useState(false);
  useEffect(() => {
    setShowChart(true);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* 1. Header Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <RevenueCard 
           title="Lifetime Revenue" 
           amount={lifetimeRevenue} 
           subtitle="Total Generated All Time" 
           loading={loading}
           colorScheme="blue"
         />
         <RevenueCard 
           title="This Month" 
           amount={monthlyRevenue} 
           subtitle="Current Billing Cycle" 
           loading={loading}
           colorScheme="teal"
         />
         <RevenueCard 
           title="Today's Sales" 
           amount={todayRevenue} 
           subtitle="24h Performance" 
           loading={loading}
           colorScheme="blue"
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 2. Payment Split Pie Chart */}
        {showChart ? (
          <PaymentSplitChart data={paymentSplit} loading={loading} />
        ) : (
          <div className="w-full h-full min-h-[300px] bg-slate-50 animate-pulse rounded-3xl" />
        )}

        {/* 3. Profit Estimation Card (Gradient Border Premium UI) */}
        <Card className="rounded-3xl shadow-xl overflow-hidden relative group bg-white/95 backdrop-blur-xl h-full flex flex-col justify-center border-0 p-[2px]">
          {/* Animated Gradient Border Layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 group-hover:opacity-100 transition-opacity duration-200 rounded-3xl z-0"></div>
          
          <div className="relative z-10 bg-white/95 backdrop-blur-2xl rounded-[22px] h-full p-8 flex flex-col justify-between border border-slate-100">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner">
                  <BadgePercent size={32} strokeWidth={2.5}/>
                </div>
                <div className="bg-indigo-100 text-indigo-700 font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl shadow-sm">
                  Estimated Margin
                </div>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-800 mb-2">Net Profit Estimation</h2>
              <p className="text-slate-500 font-medium">Calculated based on (Sale Rate - Purchase Rate) from recent 1000 items.</p>
            </div>
            
            <div className="mt-8">
              {loading ? (
                <div className="h-16 w-48 bg-slate-100 animate-pulse rounded-2xl" />
              ) : (
                <div className="flex items-end gap-3">
                  <span className="text-6xl font-black text-slate-900 tracking-tighter">₹{estimatedProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-indigo-600 font-bold mb-2 flex items-center"><Activity size={18} className="mr-1"/> healthy</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

    </div>
  );
}
