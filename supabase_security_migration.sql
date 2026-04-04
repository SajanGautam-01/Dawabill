-- ==========================================
-- PRODUCTION HARDENING MIGRATION
-- ==========================================

-- 1. Audit Logs for Security & Debugging
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID, 
    action TEXT NOT NULL,
    severity TEXT DEFAULT 'info', -- info, warn, error, critical
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Store Isolation' AND tablename = 'audit_logs') THEN
        CREATE POLICY "Store Isolation" ON public.audit_logs FOR ALL USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));
    END IF;
END $$;

-- 2. Optimized Aggregation Functions (Dashboard Performance)

-- Get Top Selling Products (Aggregated on Server)
DROP FUNCTION IF EXISTS public.get_top_selling_products(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_top_selling_products(p_store_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (name TEXT, value BIGINT) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT p.name, SUM(bi.quantity) as value
    FROM public.bill_items bi
    JOIN public.products p ON bi.product_id = p.id
    WHERE bi.store_id = p_store_id
    GROUP BY p.name
    ORDER BY value DESC
    LIMIT p_limit;
END;
$$;

-- Get Revenue Stats (Aggregated on Server)
DROP FUNCTION IF EXISTS public.get_revenue_stats(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_revenue_stats(p_store_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (date TEXT, revenue NUMERIC) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT TO_CHAR(created_at, 'Mon DD') as date, SUM(total_amount) as revenue
    FROM public.bills
    WHERE store_id = p_store_id AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY date, TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY TO_CHAR(created_at, 'YYYY-MM-DD') ASC;
END;
$$;

-- 3. Hardened Atomic Bill Creation (v3)
-- Improvements: Concurrency locking, Subscription check, Audit logging
CREATE OR REPLACE FUNCTION public.create_bill_v3(
  p_store_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_payment_mode TEXT,
  p_items JSONB 
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_caller_store_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_db_sale_rate NUMERIC;
  v_db_stock INTEGER;
  v_calculated_subtotal NUMERIC := 0;
  v_calculated_gst NUMERIC := 0;
  v_calculated_total NUMERIC := 0;
  v_bill_number TEXT;
  v_sub_status TEXT;
  v_result JSONB;
BEGIN
  -- 🛡️ SECURITY GATE: Verify caller identity
  SELECT store_id INTO v_caller_store_id FROM public.users 
  WHERE id = auth.uid();

  IF v_caller_store_id IS NULL OR v_caller_store_id != p_store_id THEN
    RAISE EXCEPTION 'Security Violation: Post-authentication bypass detected. Incident logged.';
  END IF;

  -- 1. Subscription Guard (Backend Enforcement)
  SELECT status INTO v_sub_status FROM public.subscriptions 
  WHERE store_id = p_store_id AND expiry_date > NOW() 
  ORDER BY expiry_date DESC LIMIT 1;

  IF v_sub_status IS NULL OR v_sub_status != 'active' THEN
    INSERT INTO public.audit_logs (store_id, action, severity, metadata)
    VALUES (p_store_id, 'BILL_CREATION_DENIED', 'warn', jsonb_build_object('reason', 'subscription_expired'));
    RAISE EXCEPTION 'Store subscription is expired or inactive. Please upgrade to continue billing.';
  END IF;

  -- 2. Generate Unique Bill Number
  v_bill_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  -- 3. Validation Loop with ROW LOCKING
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- SELECT FOR UPDATE prevents multiple users from selling the same item simultaneously
    -- if it would result in negative stock.
    SELECT sale_rate, stock_quantity INTO v_db_sale_rate, v_db_stock
    FROM public.products
    WHERE id = v_product_id AND store_id = p_store_id
    FOR UPDATE; 

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found.', v_product_id;
    END IF;

    IF v_db_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product. Stock: %, Needed: %', v_db_stock, v_quantity;
    END IF;

    v_calculated_subtotal := v_calculated_subtotal + (v_db_sale_rate * v_quantity);
  END LOOP;

  -- 4. Financial Calculation (Server-Side Truth)
  v_calculated_gst := v_calculated_subtotal * 0.12;
  v_calculated_total := v_calculated_subtotal + v_calculated_gst;

  -- 5. Insert Bill Record
  INSERT INTO public.bills (store_id, bill_number, customer_name, customer_phone, total_amount, gst_amount, payment_mode)
  VALUES (p_store_id, v_bill_number, p_customer_name, p_customer_phone, v_calculated_total, v_calculated_gst, p_payment_mode)
  RETURNING id INTO v_bill_id;

  -- 6. Insert Items & Final Stock Update
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    INSERT INTO public.bill_items (store_id, bill_id, product_id, quantity, price)
    SELECT p_store_id, v_bill_id, id, v_quantity, sale_rate 
    FROM public.products WHERE id = v_product_id;

    UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
  END LOOP;

  -- 7. Audit Logging (Success)
  INSERT INTO public.audit_logs (store_id, action, severity, metadata)
  VALUES (p_store_id, 'BILL_CREATED', 'info', jsonb_build_object('bill_id', v_bill_id, 'amount', v_calculated_total));

  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);

EXCEPTION WHEN OTHERS THEN
  -- Postgres automatically rolls back transaction on exception
  INSERT INTO public.audit_logs (store_id, action, severity, metadata)
  VALUES (p_store_id, 'BILL_CREATION_FAILED', 'error', jsonb_build_object('error', SQLERRM, 'items', p_items));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ==========================================
-- 4. PERFORMANCE OPTIMIZATION (INDEXING)
-- ==========================================

-- Index for Scalable Pharmacy Inventory Search
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_name_store ON public.products (store_id, name);

-- Index for Expiry & Inventory Alerts (Dashboard Performance)
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON public.products (store_id, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON public.products (store_id, expiry_date);

-- Index for Fast Billing History & Reports
CREATE INDEX IF NOT EXISTS idx_bills_created_at_store ON public.bills (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_items_product ON public.bill_items (product_id);

-- ==========================================
-- 5. DATA INTEGRITY CONSTRAINTS
-- ==========================================

-- Fail-safe: Ensure stock can NEVER be negative, even due to a race condition or manual edit.
-- This works in tandem with create_bill_v3 logic
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS check_stock_non_negative;
ALTER TABLE public.products ADD CONSTRAINT check_stock_non_negative CHECK (stock_quantity >= 0);

-- Ensure updated_at is always refreshed via trigger
CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_products_timestamp ON public.products;
CREATE TRIGGER tr_update_products_timestamp
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();
