"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/hooks/useStore";
import { Card, CardContent } from "@/components/ui/Card";
import { AlertCircle } from "lucide-react";

export default function FailedPaymentsAdminPage() {
  const { userRole } = useStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userRole !== 'admin') {
      setLoading(false);
      return;
    }

    const fetchFailedPayments = async () => {
      try {
        const res = await fetch("/api/admin/failed-payments");
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Failed to fetch from tracking server");
        
        setPayments(data.payments || []);
      } catch (err: any) {
        setError(err.message || "Network Error");
      } finally {
        setLoading(false);
      }
    };

    fetchFailedPayments();
  }, [userRole]);

  if (userRole !== "admin") {
    return <div className="p-8 text-center text-red-600 font-bold bg-white m-12 rounded-xl shadow-sm border border-red-100">Unauthorized Access</div>;
  }

  if (loading) {
    return <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Connecting to Payment Logs...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-12 p-6">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle size={28} className="text-red-500 drop-shadow-sm" />
        <h1 className="text-2xl font-black text-slate-800">Failed Payment Monitor</h1>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium shadow-sm">
          🚨 Critical Diagnostic Read Error: {error}
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm border border-slate-200 bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold tracking-wide">
                  <tr>
                    <th className="px-6 py-4 w-1/4">Order ID</th>
                    <th className="px-6 py-4 w-2/4">Webhook Gateway Reason</th>
                    <th className="px-6 py-4 w-1/4">Timestamp Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center p-12 text-slate-400 font-medium tracking-wide">
                        No failed payments trapped by the SQL net yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-red-50/20 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 tracking-tight">{p.order_id}</td>
                        <td className="px-6 py-4">
                           <span className="inline-block px-3 py-1.5 bg-red-50 text-red-700 font-bold text-xs rounded-lg border border-red-100 leading-tight block truncate sm:whitespace-normal break-words max-w-sm">
                             {p.reason}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                          {new Date(p.created_at).toLocaleString('en-IN', {
                             dateStyle: 'medium',
                             timeStyle: 'medium'
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
