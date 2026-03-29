import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { AlertCircle } from "lucide-react";

interface LowStockAlertProps {
  items: { id: string; name: string; stock_quantity: number }[];
  loading: boolean;
}

export const LowStockAlert = memo(({ items, loading }: LowStockAlertProps) => {
  return (
    <Card className="rounded-3xl border border-red-100 shadow-xl transition-all duration-200 bg-white/95 backdrop-blur-xl overflow-hidden h-full">
      <CardHeader className="p-8 border-b border-red-50 bg-red-50/50 rounded-t-3xl">
        <CardTitle className="text-xl font-bold flex items-center gap-3 text-red-600">
          <AlertCircle size={22}/> Low Stock Alerts
        </CardTitle>
        <CardDescription className="text-red-500/80 font-medium">Products with 10 or fewer items remaining.</CardDescription>
      </CardHeader>
      <CardContent className="p-8 pt-6">
         {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-2xl w-full"></div>)}
            </div>
         ) : items.length > 0 ? (
           <div className="space-y-4">
             {items.map(p => (
               <div key={p.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-red-200 hover:-translate-y-0.5 transition-all">
                 <span className="font-bold text-slate-800 text-base">{p.name}</span>
                 <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-xl text-xs font-black tracking-widest shadow-inner">{p.stock_quantity} LEFT</span>
               </div>
             ))}
           </div>
         ) : (
           <div className="text-slate-500 text-center font-bold py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">Stock levels are healthy.</div>
         )}
      </CardContent>
    </Card>
  );
});

LowStockAlert.displayName = 'LowStockAlert';
