import { memo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const SalesLineChart = memo(({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
      <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} activeDot={{r: 6, fill: '#1d4ed8'}} />
      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
      <Tooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`₹${value}`, 'Sales']} />
    </LineChart>
  </ResponsiveContainer>
));

SalesLineChart.displayName = 'SalesLineChart';

export const TopProductsPieChart = memo(({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}>
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
    </PieChart>
  </ResponsiveContainer>
));

TopProductsPieChart.displayName = 'TopProductsPieChart';

export const MonthlyRevenueBarChart = memo(({ data }: { data: any[] }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 5, right: 0, bottom: 5, left: -10 }}>
      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => [`₹${value}`, 'Revenue']} />
      <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
    </BarChart>
  </ResponsiveContainer>
));

MonthlyRevenueBarChart.displayName = 'MonthlyRevenueBarChart';
