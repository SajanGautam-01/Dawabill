-- ==========================================
-- PHASE 4: FINAL PRODUCTION HARDENING (v5)
-- ==========================================

-- 1. Ensure idempotency and payment tracking
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS external_transaction_id TEXT;

-- 2. Audit Table for Webhook Reliability
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE,
    event_type TEXT,
    payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Advanced Atomic Bill Creation (v5)
-- Improvements: Idempotency check, Strict Stock >= quantity, Expiry validation, Active Discount check
CREATE OR REPLACE FUNCTION public.create_bill_v5(
  p_store_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_payment_mode TEXT,
  p_items JSONB,
  p_idempotency_key TEXT,
  p_external_transaction_id TEXT DEFAULT NULL,
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
  v_db_expiry DATE;
  v_calculated_subtotal NUMERIC := 0;
  v_calculated_gst NUMERIC := 0;
  v_calculated_total NUMERIC := 0;
  v_discount_val NUMERIC := 0;
  v_discount_type TEXT;
  v_discount_expiry DATE;
  v_bill_number TEXT;
  v_sub_status TEXT;
  v_gst_rate NUMERIC := 0.12;
  v_existing_bill_id UUID;
  v_existing_bill_number TEXT;
BEGIN
  -- 1. IDEMPOTENCY CHECK (Rule 1: Prevent Duplicate Bills)
  SELECT id, bill_number INTO v_existing_bill_id, v_existing_bill_number 
  FROM public.bills WHERE idempotency_key = p_idempotency_key AND store_id = p_store_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 
      'bill_id', v_existing_bill_id, 
      'bill_number', v_existing_bill_number,
      'is_duplicate', true
    );
  END IF;

  -- 2. Subscription Guard
  SELECT status INTO v_sub_status FROM public.subscriptions 
  WHERE store_id = p_store_id AND expiry_date > NOW() 
  ORDER BY expiry_date DESC LIMIT 1;

  IF v_sub_status IS NULL OR v_sub_status != 'active' THEN
    RAISE EXCEPTION 'Subscription expired or inactive.';
  END IF;

  -- 3. Fetch Global GST Rate from Settings
  SELECT COALESCE(default_gst_rate, 0.12) INTO v_gst_rate 
  FROM public.settings WHERE store_id = p_store_id;

  -- 4. Validation Loop (Rule 3: Inventory Safety & Expiry)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- SELECT FOR UPDATE prevents multiple users from selling the same item simultaneously
    SELECT sale_rate, stock_quantity, expiry_date INTO v_db_sale_rate, v_db_stock, v_db_expiry
    FROM public.products WHERE id = v_product_id AND store_id = p_store_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found.', v_product_id;
    END IF;

    -- A. Stock check (Rule 3: Strict stock >= quantity)
    IF v_db_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product. Stock: %, Needed: %', v_db_stock, v_quantity;
    END IF;

    -- B. Expiry check (Rule 3: Prevent selling expired drugs)
    IF v_db_expiry IS NOT NULL AND v_db_expiry < CURRENT_DATE THEN
      RAISE EXCEPTION 'Product % has expired (EXP: %). Cannot create bill.', v_product_id, v_db_expiry;
    END IF;

    v_calculated_subtotal := v_calculated_subtotal + (v_db_sale_rate * v_quantity);
  END LOOP;

  -- 5. Discount Handling (Rule 4: Discount Validation)
  IF p_discount_id IS NOT NULL THEN
     -- Assume discounts table has is_active and optionally expiry_date
     SELECT value, discount_type INTO v_discount_val, v_discount_type 
     FROM public.discounts WHERE id = p_discount_id AND store_id = p_store_id AND is_active = true;
     
     IF FOUND THEN
        IF v_discount_type = 'percentage' THEN
           v_calculated_total := v_calculated_subtotal * (v_discount_val / 100);
           v_discount_val := v_calculated_total; -- actual val in currency
        END IF;
        -- Future-proof: Add expiry_date validation for discounts if column exists 
     ELSE
        v_discount_val := 0;
     END IF;
  END IF;

  -- 6. Recalculate Final Financials (Rule 1: Internal Recalculation)
  v_calculated_gst := (v_calculated_subtotal - v_discount_val) * v_gst_rate;
  v_calculated_total := (v_calculated_subtotal - v_discount_val) + v_calculated_gst;

  -- 7. Generate Unique Bill Number
  v_bill_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- 8. Commit Bill (Rule 5: Logging success)
  INSERT INTO public.bills (
    store_id, bill_number, customer_name, customer_phone, 
    total_amount, gst_amount, discount_amount, discount_id, 
    payment_mode, idempotency_key, payment_status, external_transaction_id
  )
  VALUES (
    p_store_id, v_bill_number, p_customer_name, p_customer_phone, 
    v_calculated_total, v_calculated_gst, v_discount_val, p_discount_id, 
    p_payment_mode, p_idempotency_key, 'pending', p_external_transaction_id
  )
  RETURNING id INTO v_bill_id;

  -- 9. Commit Items & Final Stock Update
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    INSERT INTO public.bill_items (store_id, bill_id, product_id, quantity, price)
    SELECT p_store_id, v_bill_id, id, v_quantity, sale_rate 
    FROM public.products WHERE id = v_product_id;

    UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
  END LOOP;

  -- 10. Audit Logging
  INSERT INTO public.audit_logs (store_id, action, severity, metadata)
  VALUES (p_store_id, 'BILL_CREATED_V5', 'info', jsonb_build_object('bill_id', v_bill_id, 'idempotency_key', p_idempotency_key));

  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);

EXCEPTION WHEN OTHERS THEN
  -- Rule 5: Logging failure
  INSERT INTO public.audit_logs (store_id, action, severity, metadata)
  VALUES (p_store_id, 'BILL_CREATION_FAILED_V5', 'error', jsonb_build_object('error', SQLERRM, 'idempotency_key', p_idempotency_key));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
