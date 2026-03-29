"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Search, TrendingDown, Users, AlertCircle, IndianRupee, History, PackageOpen, Calculator } from "lucide-react";
import { format, subDays } from "date-fns";

export default function SmartReportsPage() {
  const { storeId, loading: storeLoading } = useStore();
  const [loading, setLoading] = useState(true);

  // Smart Data States
  const [expiryLoss, setExpiryLoss] = useState(0);
  const [expiredItemsCount, setExpiredItemsCount] = useState(0);
  
  const [stockPredictions, setStockPredictions] = useState<any[]>([]);
  
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    generateSmartInsights();
  }, [storeId]);

  const generateSmartInsights = async () => {
    setLoading(true);

    try {
      const today = new Date().toISOString();
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      // 1. Expiry Loss Calculation
      // Find all products that are currently in stock but their expiry date has passed.
      const { data: expiredProducts } = await supabase
        .from('products')
        .select('id, purchase_rate, sale_rate, stock_quantity')
        .eq('store_id', storeId)
        .gt('stock_quantity', 0)
        .lt('expiry_date', today);

      if (expiredProducts) {
        let totalLoss = 0;
        expiredProducts.forEach(p => {
          // If purchase_rate is missing, approximate loss with sale_rate
          const costBasis = p.purchase_rate || (p.sale_rate * 0.7); 
          totalLoss += costBasis * p.stock_quantity;
        });
        setExpiryLoss(totalLoss);
        setExpiredItemsCount(expiredProducts.length);
      }

      // 2. Low Stock Prediction (Run-Rate Algorithm)
      // Fetch all bill items from the last 30 days to calculate simple velocity
      const { data: recentSales } = await supabase
        .from('bill_items')
        .select('product_id, quantity, products(name, stock_quantity)')
        .eq('store_id', storeId)
        .gte('created_at', thirtyDaysAgo);

      if (recentSales) {
        const salesVelocity: Record<string, { name: string, sold30Days: number, currentStock: number }> = {};
        
        recentSales.forEach((item: any) => {
          if (!item.products) return;
          const pid = item.product_id;
          if (!salesVelocity[pid]) {
            salesVelocity[pid] = {
              name: item.products.name,
              sold30Days: 0,
              currentStock: item.products.stock_quantity
            };
          }
          salesVelocity[pid].sold30Days += item.quantity;
        });

        const predictions: any[] = [];
        Object.values(salesVelocity).forEach(data => {
          const runRatePerDay = data.sold30Days / 30;
          if (runRatePerDay > 0 && data.currentStock > 0) {
            const daysRemaining = Math.floor(data.currentStock / runRatePerDay);
            // Only flag if it will run out in less than 14 days
            if (daysRemaining <= 14) {
              predictions.push({ ...data, runRatePerDay, daysRemaining });
            }
          } else if (data.currentStock === 0 && data.sold30Days > 0) {
            predictions.push({ ...data, runRatePerDay, daysRemaining: 0 }); // Already out but high demand
          }
        });

        // Sort by the most urgent (fewest days remaining)
        predictions.sort((a,b) => a.daysRemaining - b.daysRemaining);
        setStockPredictions(predictions.slice(0, 5));
      }

      // 3. Top Customers (Loyalty Identification)
      const { data: allBills } = await supabase
        .from('bills')
        .select('customer_phone, customer_name, total_amount')
        .eq('store_id', storeId)
        .not('customer_phone', 'is', null);

      if (allBills) {
        const customers: Record<string, { phone: string, name: string, totalSpend: number, visits: number }> = {};
        allBills.forEach(b => {
          const phone = b.customer_phone?.trim();
          if (!phone || phone.length < 5) return; // ignore empty/invalid
          
          if (!customers[phone]) {
            customers[phone] = { phone, name: b.customer_name || 'Unknown', totalSpend: 0, visits: 0 };
          }
          customers[phone].totalSpend += Number(b.total_amount);
          customers[phone].visits += 1;
          // Upgrade name if we found a better one
          if (b.customer_name && customers[phone].name === 'Unknown') customers[phone].name = b.customer_name;
        });

        const top = Object.values(customers).sort((a,b) => b.totalSpend - a.totalSpend).slice(0, 5);
        setTopCustomers(top);
      }

    } catch (err) {
      console.error("Smart Insights Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchCustomer = async () => {
    if (!customerSearch || customerSearch.length < 4 || !storeId) return;
    setSearchingCustomer(true);
    
    const { data } = await supabase
      .from('bills')
      .select('bill_number, created_at, total_amount, customer_name')
      .eq('store_id', storeId)
      .ilike('customer_phone', `%${customerSearch}%`)
      .order('created_at', { ascending: false });
      
    if (data) setCustomerHistory(data);
    setSearchingCustomer(false);
  };

  if (storeLoading || loading) {
    return <div className="p-12 flex justify-center text-slate-500 animate-pulse">Running smart calculations...</div>;
  }

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Smart Insights</h1>
        <p className="text-slate-500 mt-1">AI-driven metrics and predictive analytics directly from your store data.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 1. Expiry Loss Calculation */}
        <Card className="shadow-lg border-red-200 bg-gradient-to-br from-red-50 to-white overflow-hidden relative group">
          <div className="absolute -right-4 -top-6 opacity-5 group-hover:scale-110 transition-transform"><TrendingDown size={180}/></div>
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="text-xl flex items-center gap-2 text-red-700">
              <Calculator size={20}/> Expiry Financial Loss
            </CardTitle>
            <CardDescription className="text-red-700/70 text-base">Dead stock value currently sitting in inventory.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-4">
            <div className="flex items-end gap-3 mb-2">
              <span className="text-5xl font-black text-red-600 flex items-start">
                <IndianRupee size={28} className="mt-2 text-red-500/70"/>
                {expiryLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <p className="text-sm font-semibold text-red-800 bg-red-100 inline-block px-3 py-1 rounded-full">
              {expiredItemsCount} {expiredItemsCount === 1 ? 'batch' : 'batches'} completely expired
            </p>
            <div className="mt-4 text-xs text-red-500 font-medium">
              💡 Tip: Generate "Expiring Soon" reports monthly to run clearance discounts.
            </div>
          </CardContent>
        </Card>

        {/* 2. Low Stock Prediction */}
        <Card className="shadow-lg border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-4 border-b border-blue-100">
            <CardTitle className="text-xl flex items-center gap-2 text-blue-800">
              <PackageOpen size={20}/> Predictive Replenishment
            </CardTitle>
            <CardDescription className="text-blue-700/70">Estimated days until you stock out (based on 30-day run rate).</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
             {stockPredictions.length > 0 ? (
               <div className="space-y-4">
                 {stockPredictions.map((p, i) => (
                   <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-4 rounded-xl shadow-sm border border-blue-100 gap-3">
                     <div>
                       <span className="font-bold text-slate-800 text-base block">{p.name}</span>
                       <span className="text-xs text-slate-500 font-medium flex gap-2 mt-1">
                         <span>Stock: {p.currentStock}</span> | 
                         <span>Selling ~{p.runRatePerDay.toFixed(1)}/day</span>
                       </span>
                     </div>
                     <span className={`px-3 py-1.5 rounded-lg text-xs font-black tracking-widest text-center whitespace-nowrap ${p.daysRemaining === 0 ? 'bg-red-500 text-white shadow-md' : p.daysRemaining <= 7 ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                       {p.daysRemaining === 0 ? 'OUT OF STOCK' : `${p.daysRemaining} DAYS LEFT`}
                     </span>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-slate-500 text-sm text-center py-6">Not enough sales history to predict or stock levels are highly sufficient.</p>
             )}
          </CardContent>
        </Card>

        {/* 3. Top Loyal Customers */}
        <Card className="shadow-lg border-emerald-200 bg-gradient-to-br from-emerald-50 to-white lg:col-span-2">
          <CardHeader className="pb-4 border-b border-emerald-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-emerald-800">
                <Users size={20}/> Top Customers (VIPs)
              </CardTitle>
              <CardDescription className="text-emerald-700/70">Highest value repeat customers for relationship building.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
             {topCustomers.length > 0 ? (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {topCustomers.map((c, i) => (
                   <div key={i} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-emerald-100">
                     <div>
                       <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">#{i+1}</div>
                         <span className="font-bold text-slate-800">{c.name}</span>
                       </div>
                       <div className="mt-2 text-xs text-slate-500 font-medium">
                         <span className="block">{c.phone}</span>
                         <span className="block mt-0.5 text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded">{c.visits} total visits</span>
                       </div>
                     </div>
                     <div className="text-right">
                       <span className="text-xs text-slate-400 font-bold uppercase block mb-1">Lifetime Value</span>
                       <span className="text-lg font-black text-slate-900">₹{c.totalSpend.toFixed(0)}</span>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-slate-500 text-sm py-4">No verified customer data available yet.</p>
             )}
          </CardContent>
        </Card>

        {/* 4. Customer Purchase History Search */}
        <Card className="shadow-lg border-indigo-200 bg-gradient-to-br from-indigo-50 to-white lg:col-span-2">
          <CardHeader className="pb-4 border-b border-indigo-100">
            <CardTitle className="text-xl flex items-center gap-2 text-indigo-800">
              <History size={20}/> Deep Customer History Search
            </CardTitle>
            <CardDescription className="text-indigo-700/70">Look up past prescriptions and bills by phone number.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                <Input 
                  placeholder="Enter 10-digit Customer Phone Number..." 
                  className="pl-10 h-12 text-base border-2 border-indigo-200 focus-visible:ring-indigo-500 shadow-sm"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
                />
              </div>
              <Button onClick={searchCustomer} disabled={searchingCustomer || customerSearch.length < 4} className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                {searchingCustomer ? "Searching..." : "Pull Records"}
              </Button>
            </div>

            {customerHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-200">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Found {customerHistory.length} Bills for "{customerSearch}"</h3>
                  <span className="text-sm font-semibold text-slate-500">{customerHistory[0].customer_name}</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {customerHistory.map((bill, i) => (
                    <div key={i} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="font-bold text-indigo-600 block">{bill.bill_number}</span>
                        <span className="text-xs text-slate-500">{new Date(bill.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <span className="font-black text-slate-800">₹{bill.total_amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {customerHistory.length === 0 && customerSearch.length > 3 && !searchingCustomer && (
              <p className="text-slate-500 text-sm mt-4 text-center">No history found for this number.</p>
            )}
            
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
