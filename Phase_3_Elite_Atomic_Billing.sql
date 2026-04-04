-- ==========================================
-- ELITE PRODUCTION HARDENING: PHASE 3
-- Advanced Atomic Bill Creation (v5 Master)
-- ==========================================

-- This script upgrades your billing engine to be ultra-reliable.
-- It unifies subscription enforcement, stock safety, and idempotency.

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
  v_bill_number TEXT;
  v_sub_status TEXT;
  v_gst_rate NUMERIC := 0.12;
  v_existing_bill_id UUID;
  v_existing_bill_number TEXT;
BEGIN
  -- 🛡️ 1. CONCURRENCY PROTECTION (Elite Layer)
  -- Sequentializes multiple calls for the same store to prevent absolute race conditions.
  PERFORM pg_advisory_xact_lock(hashtext(p_store_id::text));

  -- 🛡️ 2. IDEMPOTENCY CHECK (Safety Layer)
  -- Prevent Duplicate Bills even if frontend retries multiple times.
  SELECT id, bill_number INTO v_existing_bill_id, v_existing_bill_number 
  FROM public.bills WHERE idempotency_key = p_idempotency_key AND store_id = p_store_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true, 
      'bill_id', v_existing_bill_id, 
      'bill_number', v_existing_bill_number,
      'is_duplicate', true,
      'message', 'Retrieved existing bill via idempotency check.'
    );
  END IF;

  -- 🛡️ 3. UNIFIED SUBSCRIPTION AUTHORITY (Backend Enforcement)
  -- Use the Phase 2 function to ensure Grace Periods and Trials work perfectly.
  v_sub_status := public.get_subscription_status(p_store_id);

  IF v_sub_status NOT IN ('active', 'trialing', 'grace') THEN
    INSERT INTO public.audit_logs (store_id, action, severity, metadata)
    VALUES (p_store_id, 'BILL_CREATION_DENIED', 'warn', jsonb_build_object('reason', 'subscription_restricted', 'status', v_sub_status));
    RAISE EXCEPTION 'Billing restricted. Subscription status is: %', v_sub_status;
  END IF;

  -- 4. FETCH GLOBAL GST RATE
  SELECT COALESCE(default_gst_rate, 0.12) INTO v_gst_rate 
  FROM public.settings WHERE store_id = p_store_id;

  -- 5. VALIDATION LOOP (Inventory & Expiry)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- SELECT FOR UPDATE locks the product row until the end of this transaction.
    SELECT sale_rate, stock_quantity, expiry_date INTO v_db_sale_rate, v_db_stock, v_db_expiry
    FROM public.products WHERE id = v_product_id AND store_id = p_store_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found in this store.', v_product_id;
    END IF;

    -- A. Stock check
    IF v_db_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product. Stock: %, Needed: %', v_db_stock, v_quantity;
    END IF;

    -- B. Expiry check (Protect users from selling expired drugs)
    IF v_db_expiry IS NOT NULL AND v_db_expiry < CURRENT_DATE THEN
      RAISE EXCEPTION 'Product has expired (EXP: %). Cannot create bill.', v_db_expiry;
    END IF;

    v_calculated_subtotal := v_calculated_subtotal + (v_db_sale_rate * v_quantity);
  END LOOP;

  -- 6. DISCOUNT HANDLING
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

  -- 7. RECALCULATE FINAL FINANCIALS
  v_calculated_gst := (v_calculated_subtotal - v_discount_val) * v_gst_rate;
  v_calculated_total := (v_calculated_subtotal - v_discount_val) + v_calculated_gst;

  -- 8. GENERATE BILL NUMBER
  v_bill_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- 9. COMMIT BILL
  INSERT INTO public.bills (
    store_id, bill_number, customer_name, customer_phone, 
    total_amount, gst_amount, discount_amount, discount_id, 
    payment_mode, idempotency_key, payment_status, external_transaction_id
  )
  VALUES (
    p_store_id, v_bill_number, p_customer_name, p_customer_phone, 
    v_calculated_total, v_calculated_gst, v_discount_val, p_discount_id, 
    p_payment_mode, p_idempotency_key, 'completed', p_external_transaction_id
  )
  RETURNING id INTO v_bill_id;

  -- 10. COMMIT ITEMS & UPDATE STOCK
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    INSERT INTO public.bill_items (store_id, bill_id, product_id, quantity, price)
    SELECT p_store_id, v_bill_id, id, v_quantity, sale_rate 
    FROM public.products WHERE id = v_product_id;

    UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
  END LOOP;

  -- 11. AUDIT LOGGING
  INSERT INTO public.audit_logs (store_id, action, severity, metadata)
  VALUES (p_store_id, 'BILL_CREATED_V5_ELITE', 'info', jsonb_build_object('bill_id', v_bill_id, 'idempotency_key', p_idempotency_key));

  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);

EXCEPTION WHEN OTHERS THEN
  -- Postgres automatically rolls back transaction on exception
  INSERT INTO public.audit_logs (store_id, action, severity, metadata)
  VALUES (p_store_id, 'BILL_CREATION_FAILED_V5_ELITE', 'error', jsonb_build_object('error', SQLERRM, 'idempotency_key', p_idempotency_key));
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Summary: All billing transactions are now fully protected and unified.
