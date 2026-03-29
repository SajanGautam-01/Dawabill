"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { X, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

type ProductFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ProductForm({ isOpen, onClose, onSuccess }: ProductFormProps) {
  const { storeId } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [batch, setBatch] = useState("");
  const [stock, setStock] = useState("");
  const [mrp, setMrp] = useState("");
  const [saleRate, setSaleRate] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");
  const [expiry, setExpiry] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Senior Dev Rule 4: Security - never insert without storeId validation
    if (!storeId) {
      setError("Authentication error: No store linked to current user.");
      return;
    }
    
    setLoading(true);
    setError(null);

    // Senior Dev Rule 1 & 3: Simple insert first, explicit user save
    const { error: insertError } = await supabase.from('products').insert([{
      store_id: storeId,
      name,
      batch_number: batch || null,
      stock_quantity: parseInt(stock) || 0,
      mrp: parseFloat(mrp) || 0,
      sale_rate: parseFloat(saleRate) || 0,
      purchase_rate: parseFloat(purchaseRate) || 0,
      expiry_date: expiry || null
    }]);

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      await logger.error(`Product addition failed: ${insertError.message}`, {
        storeId,
        action: 'inventory_add',
        metadata: { productName: name }
      });
    } else {
      await logger.info(`Product added: ${name}`, {
        storeId,
        action: 'inventory_add',
        metadata: { productName: name, stock }
      });
      resetForm();
      onSuccess();
      onClose();
    }
  };

  const resetForm = () => {
    setName(""); setBatch(""); setStock(""); setMrp(""); 
    setSaleRate(""); setPurchaseRate(""); setExpiry(""); setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Add New Product</h2>
            <p className="text-sm text-slate-500">Enter inventory details for tracking.</p>
          </div>
          <button onClick={() => { resetForm(); onClose(); }} className="text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-700">Product Name <span className="text-red-500">*</span></Label>
              <Input 
                id="name" 
                placeholder="e.g. Paracetamol 500mg" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="batch">Batch Number</Label>
                <Input 
                  id="batch" 
                  placeholder="e.g. BATCH-A12" 
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input 
                  id="expiry" 
                  type="date" 
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="mrp" className="text-slate-700">MRP (₹) <span className="text-red-500">*</span></Label>
                <Input 
                  id="mrp" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  required 
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseRate">Purchase Rate (₹)</Label>
                <Input 
                  id="purchaseRate" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saleRate" className="text-slate-700">Sale Rate (₹) <span className="text-red-500">*</span></Label>
                <Input 
                  id="saleRate" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  required 
                  value={saleRate}
                  onChange={(e) => setSaleRate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Initial Stock Quantity <span className="text-red-500">*</span></Label>
              <Input 
                id="stock" 
                type="number" 
                min="0"
                required 
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }} disabled={loading} type="button">
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={loading} className="min-w-[120px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Saving..." : "Save Product"}
          </Button>
        </div>

      </div>
    </div>
  );
}
