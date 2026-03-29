import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SalesChartProps {
  data: { name: string; sales: number }[];
  loading: boolean;
}

const SalesChart = memo(({ data, loading }: SalesChartProps) => {
  return (
    <Card className="rounded-3xl border border-slate-100 shadow-xl transition-all duration-200 bg-white/95 backdrop-blur-xl overflow-hidden">
      <CardHeader className="p-8 border-b border-slate-100/50 bg-slate-50/50 rounded-t-3xl">
        <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800">
          <TrendingUp size={22} className="text-blue-600"/> Last 7 Days Sales
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-8 p-8">
        <div className="h-[250px] w-full">
          {loading ? (
            <div className="w-full h-full animate-pulse bg-slate-100 rounded-2xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6, fill: '#1d4ed8'}} />
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                <Tooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1}} contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} formatter={(value: number) => [`₹${value}`, 'Sales']} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

SalesChart.displayName = 'SalesChart';
export default SalesChart;
