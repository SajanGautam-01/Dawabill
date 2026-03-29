-- ==============================================================================
-- ATOMIC STOCK DECREMENT FUNCTION
-- Prevents race conditions during concurrent billing by multiple cashiers
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_stock INTEGER;
BEGIN
  -- Atomically update the stock directly on the database level.
  -- GREATEST ensures that if the reduction goes below zero due to race conditions,
  -- it floors the inventory at exactly 0, preventing negative stock levels.
  UPDATE public.products
  SET stock_quantity = GREATEST(stock_quantity - p_amount, 0)
  WHERE id = p_product_id
  RETURNING stock_quantity INTO v_new_stock;

  -- Return the new confirmed stock level back to the Next.js client
  RETURN COALESCE(v_new_stock, 0);
END;
$$;
