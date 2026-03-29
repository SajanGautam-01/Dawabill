import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { format, startOfDay, startOfMonth } from 'date-fns';

export function useFinancialAnalytics(storeId: string | null) {
  const [bills, setBills] = useState<any[]>([]);
  const [billItems, setBillItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    let isMounted = true;

    const fetchFinancials = async () => {
      setLoading(true);

      // Fetch minimal data for lifetime bills
      const { data: billsData } = await supabase
        .from('bills')
        .select('total_amount, payment_mode, created_at')
        .eq('store_id', storeId);

      // Fetch minimal data for profit calculation (last 30 days to save client memory, or lifetime if small)
      // Since rule is "avoid large loops", we limit to recent 1000 items
      const { data: itemsData } = await supabase
        .from('bill_items')
        .select('quantity, price, products!inner(purchase_rate)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (isMounted) {
        if (billsData) setBills(billsData);
        if (itemsData) setBillItems(itemsData);
        setLoading(false);
      }
    };

    fetchFinancials();
    return () => { isMounted = false; };
  }, [storeId]);

  const stats = useMemo(() => {
    let lifetimeRevenue = 0;
    let monthlyRevenue = 0;
    let todayRevenue = 0;
    
    let cashPayments = 0;
    let razorpayPayments = 0;

    const todayStart = startOfDay(new Date()).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();

    // 1. O(N) Loop over bills for revenue & payment split
    bills.forEach(b => {
      const amt = Number(b.total_amount);
      lifetimeRevenue += amt;

      if (b.created_at >= monthStart) {
        monthlyRevenue += amt;
      }
      if (b.created_at >= todayStart) {
        todayRevenue += amt;
      }

      // Payment Split logic
      const mode = (b.payment_mode || '').toLowerCase();
      if (mode.includes('razorpay') || mode.includes('upi')) {
        razorpayPayments += amt;
      } else {
        cashPayments += amt;
      }
    });

    // 2. O(M) Loop over recent bill items for profit estimation
    let estimatedProfit = 0;
    billItems.forEach(item => {
      const saleRate = Number(item.price);
      const purchaseRate = Number(item.products?.purchase_rate || 0);
      const qty = Number(item.quantity);
      
      // Profit = (Sale - Purchase) * Quantity
      const profitPerItem = saleRate - purchaseRate;
      estimatedProfit += (profitPerItem * qty);
    });

    return {
      lifetimeRevenue,
      monthlyRevenue,
      todayRevenue,
      estimatedProfit,
      paymentSplit: [
        { name: 'Cash', value: cashPayments },
        { name: 'Razorpay / UPI', value: razorpayPayments }
      ]
    };
  }, [bills, billItems]);

  return { ...stats, loading };
}
