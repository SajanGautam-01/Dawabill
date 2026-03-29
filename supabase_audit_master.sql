-- ==============================================================================
-- 🚀 DAWABILL MASTER AUDIT & FEATURE MIGRATION (Phase 1 + Phase 2)
-- Run this in Supabase SQL Editor to enable all premium features.
-- ==============================================================================

-- 1. EXTENSIONS & LOGS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
    action TEXT NOT NULL, 
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PLANS SEEDING (CRITICAL for Subscription Guard)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    features JSONB
);

-- Deduplicate before adding constraint (Keep the first one)
DELETE FROM public.plans a USING public.plans b 
WHERE a.id > b.id AND a.name = b.name;

-- Ensure unique constraint exists for ON CONFLICT
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='plans_name_key') THEN
        ALTER TABLE public.plans ADD CONSTRAINT plans_name_key UNIQUE (name);
    END IF;
END $$;

INSERT INTO public.plans (name, price, features)
VALUES 
('Starter', 999, '["Up to 500 Invoices/mo", "Basic Inventory", "Standard Support"]'),
('Professional', 2499, '["Unlimited Invoices", "Advanced Inventory (Expiry, Batches)", "OCR Scanning", "Dynamic UPI QR", "Priority Support"]'),
('Lifetime', 24999, '["All Pro Features", "No Recurring Fees", "Dedicated Account Manager"]')
ON CONFLICT (name) DO UPDATE SET price = EXCLUDED.price, features = EXCLUDED.features;

-- 3. ADVANCED FEATURE TABLES (Discounts, Loyalty, WhatsApp)
CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL, -- 'percentage' or 'flat'
    value DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    min_bill_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='loyalty_points') THEN
        ALTER TABLE users ADD COLUMN loyalty_points INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='whatsapp_api_key') THEN
        ALTER TABLE settings ADD COLUMN whatsapp_api_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='enable_whatsapp_alerts') THEN
        ALTER TABLE settings ADD COLUMN enable_whatsapp_alerts BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 4. ROW LEVEL SECURITY (Isolation)
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Plan Read" ON plans;
CREATE POLICY "Public Plan Read" ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sub Tenant Access" ON subscriptions;
CREATE POLICY "Sub Tenant Access" ON subscriptions FOR ALL 
USING (store_id IN (SELECT store_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Discount Tenant Access" ON discounts;
CREATE POLICY "Discount Tenant Access" ON discounts FOR ALL 
USING (store_id IN (SELECT store_id FROM users WHERE id = auth.uid()));

-- 5. ATOMIC BILLING RPC
CREATE OR REPLACE FUNCTION create_bill_v2(
  p_store_id UUID, p_customer_name TEXT, p_customer_phone TEXT,
  p_total_amount NUMERIC, p_gst_amount NUMERIC, p_payment_mode TEXT, p_items JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bill_id UUID; v_item JSONB; v_bill_number TEXT;
BEGIN
  v_bill_number := 'INV-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
  INSERT INTO bills (store_id, bill_number, customer_name, customer_phone, total_amount, gst_amount, payment_mode)
  VALUES (p_store_id, v_bill_number, p_customer_name, p_customer_phone, p_total_amount, p_gst_amount, p_payment_mode)
  RETURNING id INTO v_bill_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO bill_items (store_id, bill_id, product_id, quantity, price) 
    VALUES (p_store_id, v_bill_id, (v_item->>'product_id')::UUID, (v_item->>'quantity')::INTEGER, (v_item->>'sale_rate')::NUMERIC);
    UPDATE products SET stock_quantity = stock_quantity - (v_item->>'quantity')::INTEGER WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'bill_id', v_bill_id, 'bill_number', v_bill_number);
END; $$;
