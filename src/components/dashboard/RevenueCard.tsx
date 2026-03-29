import { memo } from 'react';
import { Card, CardContent } from "@/components/ui/Card";
import { IndianRupee, ArrowUpRight } from "lucide-react";

interface RevenueCardProps {
  title: string;
  amount: number;
  subtitle: string;
  loading: boolean;
  colorScheme: 'blue' | 'teal';
}

export const RevenueCard = memo(({ title, amount, subtitle, loading, colorScheme }: RevenueCardProps) => {
  const isBlue = colorScheme === 'blue';
  
  return (
    <Card className="rounded-3xl border border-slate-100 shadow-xl overflow-hidden relative group hover:-translate-y-1 transition-all duration-200">
      <div className={`absolute top-0 left-0 w-full h-2 ${isBlue ? 'bg-gradient-to-r from-blue-400 to-indigo-500' : 'bg-gradient-to-r from-teal-400 to-emerald-500'}`}></div>
      <CardContent className="p-8">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">{title}</p>
            {loading ? (
               <div className="h-10 w-48 bg-slate-100 animate-pulse rounded-xl" />
            ) : (
               <div className="flex items-center gap-1">
                 <IndianRupee className={`h-8 w-8 stroke-[3px] ${isBlue ? 'text-blue-500' : 'text-teal-500'} -mt-1`} />
                 <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-800">
                   {amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                 </h2>
               </div>
            )}
            <p className={`text-sm font-bold flex items-center gap-1 ${isBlue ? 'text-blue-600' : 'text-teal-600'}`}>
              <ArrowUpRight size={16} strokeWidth={3} /> {subtitle}
            </p>
          </div>
          <div className={`p-4 rounded-2xl ${isBlue ? 'bg-blue-50 text-blue-500' : 'bg-teal-50 text-teal-500'}`}>
            <IndianRupee size={28} strokeWidth={2.5}/>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

RevenueCard.displayName = 'RevenueCard';
