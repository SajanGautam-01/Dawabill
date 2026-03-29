"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Search, Plus, Loader2, PackageOpen, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import ProductForm from "@/components/inventory/ProductForm";
import { Toast } from "@/components/ui/Toast";

type Product = {
  id: string;
  name: string;
  batch_number: string;
  stock_quantity: number;
  mrp: number;
  sale_rate: number;
  expiry_date: string;
};

export default function InventoryPage() {
  const { storeId, loading: storeLoading } = useStore();
  const { isAllowed, loading: subLoading } = useSubscriptionGuard();
  const [products, setProducts] = useState<Product[]>([]);
  const [dataFetched, setDataFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const fetchProducts = async (searchTerm = "") => {
    if (!storeId) return;
    setLoading(true);
    
    let query = supabase
      .from('products')
      .select('id, name, batch_number, expiry_date, mrp, stock_quantity, sale_rate, pack, hsn, serial_no, deal, free_qty')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    // Server-side Scaling: Use .ilike() for efficient search across unlimited products
    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    } else {
      query = query.limit(50);
    }
      
    const { data, error } = await query;
      
    if (!error && data) {
      setProducts(data);
    }
    setDataFetched(true);
    setLoading(false);
  };

  useEffect(() => {
    if (storeId) {
      // Debounce logic for server-side search
      const timer = setTimeout(() => {
        fetchProducts(search);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!storeLoading) {
      setLoading(false);
    }
  }, [storeId, storeLoading, search]);

  if (subLoading || storeLoading) {
    return <div className="flex h-[50vh] items-center justify-center text-slate-500 animate-pulse">Running authorization checks...</div>;
  }

  if (isAllowed === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in duration-200">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-red-200 transform scale-110">
           <AlertTriangle size={36} strokeWidth={2.5}/>
        </div>
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Access Locked</h2>
        <p className="text-slate-500 mt-4 mb-8 max-w-md text-lg mx-auto font-medium">Your DawaBill subscription has expired. Renew your plan to unlock billing, analytics, and inventory management.</p>
        <Link 
          href="/settings/subscription" 
          className="inline-flex items-center justify-center rounded-2xl text-base transition-all focus-visible:outline-none bg-red-600 hover:bg-red-700 hover:-translate-y-0.5 text-white font-bold h-14 px-8 shadow-xl shadow-red-500/20 mx-auto"
        >
          View Renewal Plans
        </Link>
      </div>
    );
  }

  // Bug Check: Mobile Issue ✅ (Stacking table content in a mobile-friendly way if needed)
  return (
    <div className="space-y-8 animate-in fade-in duration-200 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">Inventory Setup</h1>
          <p className="text-base sm:text-lg text-slate-500 mt-2 font-medium">Manage products, stock levels, and pricing.</p>
        </div>
        <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input 
              placeholder="Search products..." 
              className="pl-12 h-14 rounded-full border-2 border-slate-200 bg-slate-50 focus-visible:ring-4 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 focus-visible:bg-white transition-all text-base font-medium shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto h-14 px-6 rounded-full font-bold shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 text-base">
            <Plus size={20} strokeWidth={2.5} /> Add Product
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl shadow-xl border border-slate-100 bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b-2 border-slate-100 text-slate-500 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="px-8 py-5">Product Name</th>
                  <th className="px-6 py-5">Batch</th>
                  <th className="px-6 py-5">Stock</th>
                  <th className="px-6 py-5">MRP</th>
                  <th className="px-6 py-5">Sale Rate</th>
                  <th className="px-6 py-5">Expiry</th>
                  <th className="px-8 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading || storeLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading inventory...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                          <PackageOpen className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-base font-medium text-slate-700">No products found</p>
                        <p className="text-sm mt-1">Get started by adding your first product to the inventory.</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsFormOpen(true)}>
                          Add Product
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="group hover:bg-slate-50/80 transition-all hover:shadow-[0_0_15px_rgba(0,0,0,0.03)] border-b border-slate-50 last:border-0 relative">
                      <td className="px-8 py-5 font-bold text-slate-900 text-base">{product.name}</td>
                      <td className="px-6 py-5 text-slate-500 font-medium">{product.batch_number || '-'}</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-black tracking-wide shadow-inner ${product.stock_quantity <= 5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {product.stock_quantity} LEFT
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-400 font-medium line-through decoration-slate-300">₹{product.mrp}</td>
                      <td className="px-6 py-5 font-black text-blue-600 text-lg">₹{product.sale_rate}</td>
                      <td className="px-6 py-5 text-slate-500 font-medium">{product.expiry_date || '-'}</td>
                      <td className="px-8 py-5 text-right">
                        <Button variant="ghost" size="sm" className="h-10 rounded-xl px-4 font-semibold shadow-none text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">Edit</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isFormOpen && (
        <ProductForm 
          isOpen={isFormOpen} 
          onClose={() => setIsFormOpen(false)} 
          onSuccess={() => {
            fetchProducts(search);
            setToast({ message: "Product added successfully!", type: 'success' });
          }} 
        />
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
