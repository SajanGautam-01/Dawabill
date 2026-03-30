import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // 0. Try explicitly querying the Materialized View for instant responses natively
    const { data: mvData, error: mvError } = await supabaseAdmin
      .from('admin_dashboard_stats_mv')
      .select('*')
      .single();

    if (!mvError && mvData) {
      return NextResponse.json({
        stats: {
          totalBills: Number(mvData.total_bills),
          totalRevenue: Number(mvData.total_revenue),
          refundedItems: Number(mvData.refunded_items),
          failedPayments: Number(mvData.failed_payments),
          lowStockItems: Number(mvData.low_stock_items)
        }
      });
    }

    // 1. Fallback: Fetch Bills natively if the View does not exist locally yet (Safe Mode Pipeline)
    const { data: bills, error: billsError } = await supabaseAdmin
      .from('bills')
      .select('total_amount, payment_status');

    if (billsError) throw billsError;

    let totalRevenue = 0;
    let totalBills = 0;
    let refundedCount = 0;

    if (bills) {
      bills.forEach(b => {
        totalBills++;
        if (b.payment_status === 'refunded') {
          refundedCount++;
        } else if (b.payment_status === 'paid' || b.payment_status === 'success') {
          totalRevenue += Number(b.total_amount || 0);
        }
      });
    }

    // 2. Fetch failed webhooks count
    const { count: failedCount, error: failedError } = await supabaseAdmin
      .from('failed_payments')
      .select('*', { count: 'exact', head: true });

    if (failedError && failedError.code !== '42P01') { // Ignore table not found error if setup is delayed
        console.error("Failed payments count error:", failedError);
    }

    // 3. Fetch low stock items
    const { count: lowStockCount, error: stockError } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact', head: true })
      .lt('stock_quantity', 10);

    if (stockError) throw stockError;

    return NextResponse.json({
      stats: {
        totalBills,
        totalRevenue,
        refundedItems: refundedCount,
        failedPayments: failedCount || 0,
        lowStockItems: lowStockCount || 0
      }
    });

  } catch (err: any) {
    console.error("Dashboard Stats API Error:", err);
    return NextResponse.json({ error: err.message || 'Server Exception' }, { status: 500 });
  }
}
