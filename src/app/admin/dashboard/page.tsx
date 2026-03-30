"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent } from "@/components/ui/Card";
import { IndianRupee, FileText, AlertTriangle, RotateCcw, PackageMinus } from "lucide-react";
import useSWR from 'swr';

interface DashboardStats {
  totalBills: number;
  totalRevenue: number;
  refundedItems: number;
  failedPayments: number;
  lowStockItems: number;
}

export default function AdminDashboardPage() {
  const { userRole } = useStore();

  const fetcher = (url: string) => fetch(url).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch stats");
    return data.stats;
  });

  const { data: stats, error: swrError, isLoading } = useSWR<DashboardStats>(
    userRole === 'admin' ? '/api/admin/dashboard-stats' : null,
    fetcher,
    { refreshInterval: 60000, revalidateOnFocus: true } 
  );

  const loading = userRole === 'admin' && isLoading;
  const error = swrError?.message || null;

  if (userRole !== "admin") {
    return <div className="p-8 text-center text-red-600 font-bold bg-white m-12 rounded-xl border border-red-100">Unauthorized Access</div>;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-12 p-6">
        <div className="mb-8">
          <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-2xl shadow-sm border border-slate-100 bg-white">
              <CardContent className="p-6">
                <div className="h-10 w-10 bg-slate-100 rounded-lg animate-pulse mb-4"></div>
                <div className="h-3 w-24 bg-slate-100 rounded animate-pulse mb-2"></div>
                <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mt-1"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-12 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">Global Admin Command</h1>
        <p className="text-slate-500 font-medium mt-1">Real-time macro performance metrics and system anomalies.</p>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium shadow-sm mb-6">
          🚨 Data Telemetry Offline: {error}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          
          <Card className="rounded-2xl shadow-sm border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><IndianRupee size={20}/></div>
              </div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Revenue</p>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">₹{stats.totalRevenue.toLocaleString()}</h2>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-blue-100 bg-gradient-to-br from-white to-blue-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FileText size={20}/></div>
              </div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Bills</p>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{stats.totalBills}</h2>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><PackageMinus size={20}/></div>
              </div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Low Stock SKUs</p>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{stats.lowStockItems}</h2>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><RotateCcw size={20}/></div>
              </div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Refunded Orders</p>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{stats.refundedItems}</h2>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-red-100 bg-gradient-to-br from-white to-red-50/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg"><AlertTriangle size={20}/></div>
              </div>
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Failed Intents</p>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-1">{stats.failedPayments}</h2>
            </CardContent>
          </Card>

        </div>
      ) : null}
    </div>
  );
}
