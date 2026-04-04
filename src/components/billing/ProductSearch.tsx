import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Scan, Camera, Package, IndianRupee, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export type Product = {
  id: string;
  name: string;
  sale_rate: number;
  stock_quantity: number;
  gst_rate?: number;
};

interface ProductSearchProps {
  storeId: string;
  onAddProduct: (product: Product) => void;
}

const ProductSearch = React.memo(({ storeId, onAddProduct }: ProductSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const barcodeScannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!storeId || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const fetchProducts = async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('id, name, sale_rate, stock_quantity, gst_rate')
          .eq('store_id', storeId)
          .ilike('name', `%${searchQuery}%`)
          .limit(8);
          
        if (data) setSearchResults(data);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, storeId]);

  useEffect(() => {
    return () => {
      try {
        if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
      } catch {}
    };
  }, []);

  const handleBarcodeScan = () => {
    if (isScannerOpen) {
      try {
        if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
      } catch (e) {
        console.log(e);
      } finally {
        barcodeScannerRef.current = null;
        setIsScannerOpen(false);
      }
      return;
    }

    setIsScannerOpen(true);
    setTimeout(() => {
      if (barcodeScannerRef.current) return;
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      barcodeScannerRef.current = scanner;
      scanner.render((text) => {
        setSearchQuery(text);
        try {
          if (barcodeScannerRef.current) barcodeScannerRef.current.clear();
        } catch (e) {
          console.log(e);
        } finally {
          barcodeScannerRef.current = null;
        }
        setIsScannerOpen(false);
      }, (err) => console.log(err));
    }, 500);
  };

  const onSelectResult = (p: Product) => {
    onAddProduct(p);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="relative w-full">
      <div className="relative flex gap-3">
        <div className="relative flex-1 group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
            <Search className="text-muted-foreground h-5 w-5 group-focus-within:text-primary transition-colors" />
          </div>
          
          <Input 
            placeholder="Search by name, category or batch..." 
            className="pl-12 h-14 rounded-2xl bg-accent/40 border-border focus-visible:ring-primary/20 focus-visible:border-primary transition-all text-base font-bold shadow-sm w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            tabIndex={3}
          />

          <AnimatePresence>
            {(isSearching || searchQuery) && (
               <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2"
               >
                {isSearching ? (
                  <Loader2 className="text-primary h-5 w-5 animate-spin" />
                ) : (
                  <button onClick={() => setSearchQuery("")} className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                    <X size={16} strokeWidth={3} />
                  </button>
                )}
               </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button 
          variant={isScannerOpen ? "destructive" : "glass"}
          onClick={handleBarcodeScan}
          className="h-14 w-14 rounded-2xl flex items-center justify-center transition-all p-0"
        >
          {isScannerOpen ? <X size={24} /> : <Scan size={24} className="text-primary" />}
        </Button>
      </div>

      {isScannerOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          id="reader" 
          className="w-full mt-6 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-primary/20 bg-muted/30 min-h-[300px]"
        />
      )}

      {/* Search Dropdown with Motion */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute left-0 right-0 top-[calc(100%+12px)] z-[100] bg-card/95 backdrop-blur-2xl border border-border rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden"
          >
            <div className="p-2">
              {searchResults.map((p, index) => (
                <button
                  key={p.id}
                  onClick={() => onSelectResult(p)}
                  className="w-full text-left px-5 py-4 rounded-2xl hover:bg-primary/[0.08] focus:bg-primary/[0.08] focus:outline-none transition-all flex justify-between items-center group/item"
                  tabIndex={4}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center group-hover/item:bg-primary/20 transition-colors">
                       <Package size={20} className="text-muted-foreground group-hover/item:text-primary" />
                    </div>
                    <div>
                      <p className="font-display text-base font-black tracking-tight text-foreground">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={p.stock_quantity <= 10 ? "amber" : "emerald"} className="h-4 px-1.5 text-[8px] tracking-widest font-black uppercase">
                          {p.stock_quantity} left
                        </Badge>
                        {p.gst_rate !== undefined && (
                          <Badge variant="outline" className="h-4 px-1.5 text-[8px] tracking-widest font-black uppercase border-primary/30 text-primary">
                            {p.gst_rate}% GST
                          </Badge>
                        )}
                        <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">ID: {p.id.split('-')[0]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black text-primary flex items-center tracking-tighter">
                      <IndianRupee size={16} strokeWidth={3} className="mr-0.5" />
                      {p.sale_rate}
                    </span>
                    <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.1em]">Per Unit</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ProductSearch.displayName = 'ProductSearch';
export default ProductSearch;
