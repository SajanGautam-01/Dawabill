-- ==============================================================================
-- ATOMIC BILL CREATION RPC (V2)
-- Handles validation, insertion, and inventory updates in one transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_bill_v2(
  p_store_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_total_amount NUMERIC,
  p_gst_amount NUMERIC,
  p_payment_mode TEXT,
  p_items JSONB -- Expected: Array of {product_id: UUID, quantity: INT, sale_rate: NUMERIC}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass direct RLS for this specific path
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_sale_rate NUMERIC;
  v_db_sale_rate NUMERIC;
  v_db_stock INTEGER;
  v_calculated_subtotal NUMERIC := 0;
  v_calculated_gst NUMERIC := 0;
  v_calculated_total NUMERIC := 0;
  v_bill_number TEXT;
  v_result JSONB;
BEGIN
  -- 1. Generate Bill Number (INV-YYMMDD-XXX)
  v_bill_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  -- 2. Validate Items Loop (Verification Phase)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_sale_rate := (v_item->>'sale_rate')::NUMERIC;

    -- Fetch critical data from products table
    SELECT sale_rate, stock_quantity INTO v_db_sale_rate, v_db_stock
    FROM public.products
    WHERE id = v_product_id AND store_id = p_store_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found or store mismatch.', v_product_id;
    END IF;

    -- A. Stock check (Server-side Enforcement)
    IF v_db_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product. Available: %, Requested: %', v_db_stock, v_quantity;
    END IF;

    -- B. Price check (Security: Prevent client-side injection of lower rates)
    -- We allow a 0.01 tolerance for Float rounding
    IF ABS(v_db_sale_rate - v_sale_rate) > 0.01 THEN
      RAISE EXCEPTION 'Price mismatch for product %. DB: %, Frontend: %', v_product_id, v_db_sale_rate, v_sale_rate;
    END IF;

    v_calculated_subtotal := v_calculated_subtotal + (v_db_sale_rate * v_quantity);
  END LOOP;

  -- 3. Calculate Grand Total (Standard 12% GST as per App Logic)
  -- Security: We ignore p_total_amount and p_gst_amount for the actual insertion, 
  -- recalculating everything server-side to prevent client-side price tampering.
  v_calculated_gst := v_calculated_subtotal * 0.12;
  v_calculated_total := v_calculated_subtotal + v_calculated_gst;

  -- 4. COMMIT PHASE: Insert Bill
  INSERT INTO public.bills (
    store_id, 
    bill_number, 
    customer_name, 
    customer_phone, 
    total_amount, 
    gst_amount, 
    payment_mode,
    created_at
  ) VALUES (
    p_store_id, 
    v_bill_number, 
    p_customer_name, 
    p_customer_phone, 
    v_calculated_total, -- USE CALCULATED (SERVER-SIDE)
    v_calculated_gst,   -- USE CALCULATED (SERVER-SIDE)
    p_payment_mode,
    NOW()
  ) RETURNING id INTO v_bill_id;

  -- 5. COMMIT PHASE: Insert Items & Decrement Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_sale_rate := (v_item->>'sale_rate')::NUMERIC;

    -- Final insert into junction table
    INSERT INTO public.bill_items (
      store_id, 
      bill_id, 
      product_id, 
      quantity, 
      price
    ) VALUES (
      p_store_id, 
      v_bill_id, 
      v_product_id, 
      v_quantity, 
      v_sale_rate
    );

    -- Atomic Decrement
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product_id;
  END LOOP;

  -- Build final response object
  v_result := jsonb_build_object(
    'success', true,
    'bill_id', v_bill_id,
    'bill_number', v_bill_number
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- All operations automatically rollback on EXCEPTION 
  -- We return the error message for the frontend to display
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
