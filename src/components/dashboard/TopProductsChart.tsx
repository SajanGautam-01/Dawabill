import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { BarChart as BarChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TopProductsChartProps {
  data: { name: string; value: number }[];
  loading: boolean;
}

const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const TopProductsChart = memo(({ data, loading }: TopProductsChartProps) => {
  return (
    <Card className="rounded-3xl border border-slate-100 shadow-xl transition-all duration-200 bg-white/95 backdrop-blur-xl overflow-hidden h-full">
      <CardHeader className="p-8 border-b border-slate-100/50 bg-slate-50/50 rounded-t-3xl">
        <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800">
          <BarChartIcon size={22} className="text-teal-500"/> Top 5 Products
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-8 p-8">
        <div className="h-[250px] w-full">
          {loading ? (
            <div className="w-full h-full animate-pulse bg-slate-100 rounded-2xl" />
          ) : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} />
                 <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontWeight: 600 }} />
                 <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24}>
                   {data.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

TopProductsChart.displayName = 'TopProductsChart';
export default TopProductsChart;
