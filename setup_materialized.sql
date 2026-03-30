-- Execute this inside your Supabase SQL Editor to stabilize Dashboard scaling

CREATE MATERIALIZED VIEW IF NOT EXISTS admin_dashboard_stats_mv AS
SELECT
  (SELECT COUNT(*) FROM bills) as total_bills,
  (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE payment_status IN ('paid', 'success')) as total_revenue,
  (SELECT COUNT(*) FROM bills WHERE payment_status = 'refunded') as refunded_items,
  (SELECT COUNT(*) FROM failed_payments) as failed_payments,
  (SELECT COUNT(*) FROM products WHERE stock_quantity < 10) as low_stock_items;

-- Establish native secure refresh loop functions natively RPC bindings locally  
CREATE OR REPLACE FUNCTION refresh_admin_dashboard_stats_mv()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW admin_dashboard_stats_mv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
