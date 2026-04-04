"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Search, Plus, Loader2, PackageOpen, AlertTriangle, Box, Trash2, Edit3, ShieldAlert, FileText } from "lucide-react";
import Link from "next/link";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import ProductForm from "@/components/inventory/ProductForm";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon, Package } from "lucide-react";

// Note: Re-importing correct lucide-react icons due to previous stray text
import { 
  Search as SearchIcon, 
  Plus as PlusIcon, 
  Loader2 as LoaderIcon, 
  PackageOpen as EmptyIcon, 
  AlertTriangle as AlertIcon, 
  Box as BoxIcon, 
  Trash2 as TrashIcon, 
  Edit3 as EditIcon, 
  ShieldAlert as LockIcon, 
  FileText as FileIcon 
} from "lucide-react";

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
  const { isAllowed, hoursInGracePeriod, loading: subLoading } = useSubscriptionGuard();
  const [products, setProducts] = useState<Product[]>([]);
  const isReadOnly = hoursInGracePeriod !== null;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchProducts = useCallback(async (searchTerm = "") => {
    if (!storeId) return;
    setLoading(true);
    
    let query = supabase
      .from('products')
      .select('id, name, batch_number, expiry_date, mrp, stock_quantity, sale_rate, pack, hsn, serial_no, deal, free_qty')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (searchTerm) {
      query = query.ilike('name', `%${searchTerm}%`);
    } else {
      query = query.limit(50);
    }
      
    const { data, error } = await query;
      
    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    if (storeId) {
      const timer = setTimeout(() => {
        fetchProducts(search);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!storeLoading) {
      setLoading(false);
    }
  }, [storeId, storeLoading, search, fetchProducts]);

  if (subLoading || storeLoading) {
    return <div className="flex h-[50vh] items-center justify-center text-slate-500 animate-pulse">Checking access permissions...</div>;
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mb-6 border border-slate-200">
          <LockIcon size={40} />
        </div>
        <h2 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Access Protected</h2>
        <p className="text-slate-500 mb-10 max-w-md text-lg mx-auto font-medium">
          Your DawaBill subscription has expired. Your inventory data is safe, but requires a plan to manage.
        </p>
        <Link href="/settings/subscription">
          <Button size="lg" className="h-14 px-8 rounded-xl font-bold text-lg gap-2 shadow-md active:scale-95 transition-all">
            Renew Subscription
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="view-container space-y-10 pb-20 max-w-7xl mx-auto">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-100 font-bold uppercase tracking-widest text-[9px]">Live Catalog</Badge>
            {isReadOnly && <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-100 font-bold uppercase tracking-widest text-[9px]">Read Only</Badge>}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Stock <span className="text-primary italic">Management</span></h1>
          <p className="text-slate-500 font-medium max-w-xl">
            Keep track of your medicine inventory, batches, and expiry dates.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input 
              placeholder="Search medicines..." 
              className="pl-12 h-12 rounded-xl border-slate-200 focus:border-primary transition-all font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button 
            disabled={isReadOnly}
            onClick={() => setIsFormOpen(true)}
            className="h-12 px-6 rounded-xl font-bold gap-2 w-full sm:w-auto shadow-md active:scale-95 transition-all"
          >
            {isReadOnly ? <AlertIcon size={18} /> : <PlusIcon size={18} />}
            {isReadOnly ? "Locked" : "Add Medicine"}
          </Button>
        </div>
      </div>

      {/* ── DATA DISPLAY ────────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-4">
        {loading || storeLoading ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <LoaderIcon className="h-8 w-8 animate-spin text-primary/30" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Loading Stock...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <EmptyIcon className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Medicines Found</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center shrink-0">
                      <FileIcon size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h4 className="font-bold text-slate-900 truncate">{product.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batch: {product.batch_number || "NONE"}</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "h-6 px-2 font-bold uppercase tracking-widest text-[8px] shrink-0",
                      product.stock_quantity <= 10 
                        ? "text-amber-700 bg-amber-50 border-amber-100" 
                        : "text-emerald-700 bg-emerald-50 border-emerald-100"
                    )}
                  >
                    {product.stock_quantity} Qty
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sale Rate</span>
                    <span className="font-bold text-slate-900">₹{product.sale_rate}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Expiry</span>
                    <span className={cn(
                      "text-xs font-bold font-mono tracking-wider",
                      new Date(product.expiry_date) < new Date() ? "text-red-600" : "text-slate-600"
                    )}>
                      {product.expiry_date || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl text-xs font-bold border-slate-100 text-slate-600">
                    <EditIcon size={14} className="mr-2" /> Edit
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                    <TrashIcon size={16} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <Card className="hidden md:block border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  <th className="px-8 py-5">Medicine Details</th>
                  <th className="px-6 py-5">Available Stock</th>
                  <th className="px-6 py-5">Rate & MRP</th>
                  <th className="px-6 py-5">Expiry Date</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-600">
                {loading || storeLoading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <LoaderIcon className="h-8 w-8 animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-widest">Updating...</span>
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-24 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <EmptyIcon className="h-12 w-12 opacity-20" />
                        <div className="space-y-1">
                          <p className="text-sm font-bold uppercase tracking-widest">No Medicines Found</p>
                          <p className="text-xs font-medium italic">Start adding items to build your inventory.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {products.map((product) => (
                      <motion.tr 
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group hover:bg-slate-50/50 transition-all border-b border-slate-50"
                      >
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center group-hover:text-primary group-hover:bg-primary/5 transition-colors">
                                 <FileIcon size={18} />
                              </div>
                              <div className="flex flex-col">
                                <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{product.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Batch: {product.batch_number || "NONE"}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "h-6 px-2.5 font-bold uppercase tracking-widest text-[9px]",
                              product.stock_quantity <= 10 
                                ? "text-amber-700 bg-amber-50 border-amber-100" 
                                : "text-emerald-700 bg-emerald-50 border-emerald-100"
                            )}
                          >
                            {product.stock_quantity} Units
                          </Badge>
                        </td>
                        <td className="px-6 py-6" >
                           <div className="flex flex-col">
                              <p className="font-bold text-slate-900">₹{product.sale_rate}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">MRP: ₹{product.mrp}</p>
                           </div>
                        </td>
                        <td className="px-6 py-6 font-medium text-sm">
                           <span className={cn(
                             "px-2 py-1 rounded-md text-xs font-bold font-mono tracking-wider",
                             new Date(product.expiry_date) < new Date() ? "text-red-700 bg-red-50" : "text-slate-500 bg-slate-50"
                           )}>
                             {product.expiry_date || "N/A"}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-all">
                                 <EditIcon size={16} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                                 <TrashIcon size={16} />
                              </Button>
                           </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
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
            toast("Medicine list updated.", "success");
          }} 
        />
      )}
    </div>
  );
}
