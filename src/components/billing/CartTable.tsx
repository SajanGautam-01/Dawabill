import React from 'react';
import { Trash2, IndianRupee, Package } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Product } from './ProductSearch';
import { cn } from '@/lib/utils';

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
    <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-2 space-y-3 p-1">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-muted/30 rounded-[40px] border-2 border-dashed border-border/50 animate-in fade-in zoom-in duration-700">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mb-4 opacity-50">
            <Package size={32} className="text-muted-foreground" />
          </div>
          <p className="text-lg font-bold text-muted-foreground tracking-tight">Empty Inventory Cart</p>
          <p className="text-sm text-muted-foreground/60 max-w-[200px] text-center mt-1">Search or scan medicines to begin generating a bill.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div 
              key={item.id} 
              className={cn(
                "group relative overflow-hidden bg-card border border-border p-5 rounded-3xl transition-all duration-500 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 animate-in slide-in-from-right-4 fade-in",
                "flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-display text-lg font-black tracking-tight truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </h4>
                  {item.stock_quantity <= 10 && (
                    <Badge variant="amber" className="h-4 px-1.5 text-[8px] animate-pulse">Low Stock</Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-3 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1"><IndianRupee size={12} />{item.sale_rate} per unit</span>
                  <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                  <span className="text-primary font-bold">Total ₹{item.total.toFixed(2)}</span>
                  {item.gst_rate !== undefined && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">
                      Incl. {item.gst_rate}% GST
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity & Actions */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-3 p-1.5 bg-accent/50 rounded-2xl border border-border group-focus-within:border-primary transition-colors">
                    <Input 
                      type="number" 
                      min="1" 
                      max={item.stock_quantity}
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.id, e.target.value, item.stock_quantity)}
                      className="h-9 w-20 border-none bg-transparent text-center font-bold text-base focus-visible:ring-0 shadow-none px-0"
                      tabIndex={5}
                      disabled={isSaving}
                    />
                    <div className="h-4 w-[1px] bg-border" />
                    <span className="text-[10px] font-black text-muted-foreground pr-3 uppercase tracking-tighter">Units</span>
                  </div>
                  <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest px-2">
                    {item.stock_quantity} in inventory
                  </span>
                </div>

                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => onRemoveItem(item.id)}
                  disabled={isSaving}
                  className="rounded-xl h-11 w-11 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 transition-all opacity-100 sm:opacity-50"
                >
                  <Trash2 size={18} />
                </Button>
              </div>

              {/* Selection Indicator */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform origin-top" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

CartTable.displayName = 'CartTable';
export default CartTable;
