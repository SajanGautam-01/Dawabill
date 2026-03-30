import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Scan, Camera } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '@/lib/supabaseClient';

export type Product = {
  id: string;
  name: string;
  sale_rate: number;
  stock_quantity: number;
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
          .select('id, name, sale_rate, stock_quantity')
          .eq('store_id', storeId)
          .ilike('name', `%${searchQuery}%`)
          .limit(10);
          
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
    <>
      <div className="relative group flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5 group-focus-within:text-teal-500 transition-colors" />
          <Input 
            placeholder="Type product name or use scanner..." 
            className="pl-12 h-14 rounded-2xl border-2 border-slate-200 bg-slate-50 focus-visible:ring-4 focus-visible:ring-teal-500/20 focus-visible:border-teal-500 focus-visible:bg-white transition-all text-lg font-medium shadow-sm w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            tabIndex={3}
          />
          {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 animate-spin" />}
        </div>
        <Button 
          variant="outline"
          onClick={handleBarcodeScan}
          className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center transition-all ${isScannerOpen ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-teal-500 hover:border-teal-200'}`}
        >
          {isScannerOpen ? <Scan className="animate-pulse" /> : <Camera />}
        </Button>
      </div>

      {isScannerOpen && (
        <div id="reader" className="w-full mt-4 rounded-3xl overflow-hidden border-4 border-dashed border-slate-100 bg-slate-50 min-h-[300px]"></div>
      )}

      {/* Search Dropdown */}
      {searchResults.length > 0 && (
        <div className="absolute left-6 right-6 top-[90px] z-50 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-[300px] overflow-y-auto">
          {searchResults.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectResult(p)}
              className="w-full text-left px-5 py-4 border-b border-slate-100 hover:bg-teal-50/80 focus:bg-teal-50/80 focus:outline-none transition-all flex justify-between items-center first:rounded-t-2xl last:rounded-b-2xl last:border-0"
              tabIndex={4}
            >
              <div>
                <p className="font-semibold text-slate-800">{p.name}</p>
                <p className="text-xs text-slate-500">Stock: {p.stock_quantity}</p>
              </div>
              <div className="font-medium text-blue-600">₹{p.sale_rate}</div>
            </button>
          ))}
        </div>
      )}
    </>
  );
});

ProductSearch.displayName = 'ProductSearch';
export default ProductSearch;
