import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export function useSalesAnalytics(storeId: string | null) {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let isMounted = true;

    const fetchSales = async () => {
      setLoading(true);
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('bills')
        .select('total_amount, created_at')
        .eq('store_id', storeId)
        .gte('created_at', thirtyDaysAgo);
        
      if (isMounted && data) {
        setBills(data);
      }
      if (isMounted) setLoading(false);
    };

    fetchSales();
    return () => { isMounted = false; };
  }, [storeId]);

  const stats = useMemo(() => {
    let todayRevenue = 0;
    let monthRevenue = 0;
    const dailyMap: Record<string, number> = {};
    
    // Initialize last 7 days map
    for(let i=6; i>=0; i--) {
      dailyMap[format(subDays(new Date(), i), 'MMM dd')] = 0;
    }

    const todayStart = startOfDay(new Date()).toISOString();
    
    bills.forEach(b => {
      const amt = Number(b.total_amount);
      monthRevenue += amt;
      
      if (b.created_at >= todayStart) {
        todayRevenue += amt;
      }
      
      const dateStr = format(new Date(b.created_at), 'MMM dd');
      if (dailyMap[dateStr] !== undefined) {
        dailyMap[dateStr] += amt;
      }
    });

    return {
      todayRevenue,
      monthRevenue,
      dailySales: Object.keys(dailyMap).map(k => ({ name: k, sales: dailyMap[k] }))
    };
  }, [bills]);

  return { ...stats, loading };
}

export function useTopProducts(storeId: string | null) {
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let isMounted = true;

    const fetchTopProducts = async () => {
      setLoading(true);
      // Fetch limited data for performance
      const { data } = await supabase
        .from('bill_items')
        .select('quantity, products!inner(name)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(500); // Sample last 500 items for top product calc to spare DB

      if (isMounted && data) {
        const productCounts: Record<string, number> = {};
        data.forEach((item: any) => {
           const pName = item.products?.name || 'Unknown';
           productCounts[pName] = (productCounts[pName] || 0) + item.quantity;
        });

        const top = Object.entries(productCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({ name, value }));
          
        setTopProducts(top);
      }
      if (isMounted) setLoading(false);
    };

    fetchTopProducts();
    return () => { isMounted = false; };
  }, [storeId]);

  return { topProducts, loading };
}

export function useLowStock(storeId: string | null) {
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let isMounted = true;

    const fetchLowStock = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('products')
        .select('id, name, stock_quantity')
        .eq('store_id', storeId)
        .lte('stock_quantity', 10)
        .order('stock_quantity', { ascending: true })
        .limit(5);

      if (isMounted && data) {
        setLowStock(data);
      }
      if (isMounted) setLoading(false);
    };

    fetchLowStock();
    return () => { isMounted = false; };
  }, [storeId]);

  return { lowStock, loading };
}
