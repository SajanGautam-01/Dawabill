import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface PaymentSplitProps {
  data: { name: string; value: number }[];
  loading: boolean;
}

const COLORS = ['#10b981', '#3b82f6'];

export const PaymentSplitChart = memo(({ data, loading }: PaymentSplitProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Only show chart if there's actual revenue data
  const hasData = total > 0;

  return (
    <Card className="rounded-3xl border border-slate-100 shadow-xl transition-all duration-200 bg-white/95 backdrop-blur-xl overflow-hidden h-full">
      <CardHeader className="p-8 border-b border-slate-100/50 bg-slate-50/50 rounded-t-3xl">
        <CardTitle className="text-xl font-bold flex items-center gap-3 text-slate-800">
          <PieChartIcon size={22} className="text-blue-500"/> Revenue Split
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-8 p-8">
         {loading ? (
            <div className="w-full h-[250px] animate-pulse bg-slate-100 rounded-2xl" />
         ) : !hasData ? (
            <div className="w-full h-[250px] flex items-center justify-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl">
              No Payment Data
            </div>
         ) : (
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', fontWeight: 600 }}
                  />
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontWeight: 600, fontSize: '14px', color: '#475569' }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
              </div>
            </div>
         )}
      </CardContent>
    </Card>
  );
});

PaymentSplitChart.displayName = 'PaymentSplitChart';
