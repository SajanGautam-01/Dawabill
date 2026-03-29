-- ==========================================
-- PHASE 3: SECURITY & CALCULATION UPGRADE
-- ==========================================

-- 1. Extend Bills table for discounts
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_id UUID;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- 2. Ensure RLS is enabled on all core tables
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 3. Apply Tenant Isolation Policies (Rule: One store cannot see another's data)
-- This logic assumes 'store_id' is present on all listed tables.

DO $$ 
BEGIN
    -- Bills
    DROP POLICY IF EXISTS "Bills Store Isolation" ON public.bills;
    CREATE POLICY "Bills Store Isolation" ON public.bills FOR ALL 
    USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));

    -- Bill Items
    DROP POLICY IF EXISTS "BillItems Store Isolation" ON public.bill_items;
    CREATE POLICY "BillItems Store Isolation" ON public.bill_items FOR ALL 
    USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));

    -- Products
    DROP POLICY IF EXISTS "Products Store Isolation" ON public.products;
    CREATE POLICY "Products Store Isolation" ON public.products FOR ALL 
    USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));

    -- Payment Accounts
    DROP POLICY IF EXISTS "Payments Store Isolation" ON public.payment_accounts;
    CREATE POLICY "Payments Store Isolation" ON public.payment_accounts FOR ALL 
    USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));

    -- Settings
    DROP POLICY IF EXISTS "Settings Store Isolation" ON public.settings;
    CREATE POLICY "Settings Store Isolation" ON public.settings FOR ALL 
    USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));

END $$;

-- 4. ATOMIC BILL CREATION (V4)
-- Improvements: Server-side discount recalculation & total verification
CREATE OR REPLACE FUNCTION public.create_bill_v4(
  p_store_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_payment_mode TEXT,
  p_items JSONB,
  p_discount_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_db_sale_rate NUMERIC;
  v_db_stock INTEGER;
  v_calculated_subtotal NUMERIC := 0;
  v_calculated_gst NUMERIC := 0;
  v_calculated_total NUMERIC := 0;
  v_discount_val NUMERIC := 0;
  v_discount_type TEXT;
  v_bill_number TEXT;
  v_sub_status TEXT;
  v_gst_rate NUMERIC := 0.12; -- Default 12%
BEGIN
  -- 1. Subscription Guard
  SELECT status INTO v_sub_status FROM public.subscriptions 
  WHERE store_id = p_store_id AND expiry_date > NOW() 
  ORDER BY expiry_date DESC LIMIT 1;

  IF v_sub_status IS NULL OR v_sub_status != 'active' THEN
    RAISE EXCEPTION 'Subscription expired or inactive.';
  END IF;

  -- 2. Fetch Global GST Rate from Settings
  SELECT COALESCE(default_gst_rate, 0.12) INTO v_gst_rate 
  FROM public.settings WHERE store_id = p_store_id;

  -- 3. Validation Loop & Subtotal Calculation
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    SELECT sale_rate, stock_quantity INTO v_db_sale_rate, v_db_stock
    FROM public.products WHERE id = v_product_id AND store_id = p_store_id FOR UPDATE;

    IF v_db_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %', v_product_id, v_db_stock;
    END IF;

    v_calculated_subtotal := v_calculated_subtotal + (v_db_sale_rate * v_quantity);
  END LOOP;

  -- 4. Discount Handling (Server-side Truth)
  IF p_discount_id IS NOT NULL THEN
     SELECT value, discount_type INTO v_discount_val, v_discount_type 
     FROM public.discounts WHERE id = p_discount_id AND store_id = p_store_id AND is_active = true;
     
     IF FOUND THEN
        IF v_discount_type = 'percentage' THEN
           v_discount_val := v_calculated_subtotal * (v_discount_val / 100);
        END IF;
     ELSE
        v_discount_val := 0;
     END IF;
  END IF;

  -- 5. Final Financials
  v_calculated_gst := (v_calculated_subtotal - v_discount_val) * v_gst_rate;
  v_calculated_total := (v_calculated_subtotal - v_discount_val) + v_calculated_gst;

  -- 6. Generate Bill Number
  v_bill_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  -- 7. Commit Bill
  INSERT INTO public.bills (store_id, bill_number, customer_name, customer_phone, total_amount, gst_amount, discount_amount, discount_id, payment_mode)
  VALUES (p_store_id, v_bill_number, p_customer_name, p_customer_phone, v_calculated_total, v_calculated_gst, v_discount_val, p_discount_id, p_payment_mode)
  RETURNING id INTO v_bill_id;

  -- 8. Commit Items & Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    INSERT INTO public.bill_items (store_id, bill_id, product_id, quantity, price)
    SELECT p_store_id, v_bill_id, id, v_quantity, sale_rate FROM public.products WHERE id = v_product_id;

    UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);
END;
$$;
