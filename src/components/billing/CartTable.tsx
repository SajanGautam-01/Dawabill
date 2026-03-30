import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Product } from './ProductSearch';

export type BillItem = Product & {
  quantity: number;
  total: number;
};

interface CartTableProps {
  items: BillItem[];
  isSaving: boolean;
  onUpdateQuantity: (id: string, qtyStr: string, max: number) => void;
  onRemoveItem: (id: string) => void;
}

const CartTable = React.memo(({ items, isSaving, onUpdateQuantity, onRemoveItem }: CartTableProps) => {
  return (
    <div className="max-h-[350px] overflow-y-auto pr-1">
      {items.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium">
          No items added yet.<br/>Search and select a product to begin.
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} className="p-4 mx-2 my-2 bg-slate-50/80 rounded-2xl hover:bg-white hover:shadow-md hover:-translate-y-0.5 hover:border-blue-100 border border-transparent transition-all flex items-start justify-between group">
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-base leading-tight">{item.name}</p>
              <p className="text-sm text-slate-500 mt-1.5 font-medium">₹{item.sale_rate} x </p>
              <div className="flex items-center gap-3 mt-2.5">
                <Input 
                  type="number" 
                  min="1" 
                  max={item.stock_quantity}
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id, e.target.value, item.stock_quantity)}
                  className="h-10 w-24 rounded-xl text-base font-bold border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 px-3 bg-white"
                  tabIndex={5}
                  disabled={isSaving}
                />
                <span className="text-xs font-bold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-md">/{item.stock_quantity} left</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 ml-4">
              <span className="font-black text-slate-900 text-lg tracking-tight">₹{item.total.toFixed(2)}</span>
              <button 
                onClick={() => onRemoveItem(item.id)}
                className="bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove item"
                disabled={isSaving}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
});

CartTable.displayName = 'CartTable';
export default CartTable;
