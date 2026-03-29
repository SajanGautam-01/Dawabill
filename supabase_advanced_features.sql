-- 1. Discounts Management
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

-- 2. Loyalty Points Tracking
-- Check if column exists first (Postgres doesn't have IF NOT EXISTS for ADD COLUMN directly without plpgsql)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='loyalty_points') THEN
        ALTER TABLE users ADD COLUMN loyalty_points INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bills' AND column_name='points_earned') THEN
        ALTER TABLE bills ADD COLUMN points_earned INT DEFAULT 0;
    END IF;
END $$;

-- 3. WhatsApp Integration & Global Config
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='whatsapp_api_key') THEN
        ALTER TABLE settings ADD COLUMN whatsapp_api_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='whatsapp_phone_number') THEN
        ALTER TABLE settings ADD COLUMN whatsapp_phone_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='alert_expiry_threshold') THEN
        ALTER TABLE settings ADD COLUMN alert_expiry_threshold INT DEFAULT 30;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='enable_whatsapp_alerts') THEN
        ALTER TABLE settings ADD COLUMN enable_whatsapp_alerts BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 4. Audit Log Expansion
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logs' AND column_name='action_category') THEN
        ALTER TABLE logs ADD COLUMN action_category TEXT DEFAULT 'general';
    END IF;
END $$;

-- 5. Row Level Security (RLS) for new tables
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Policy: Stores can only see their own discounts
DROP POLICY IF EXISTS "Discounts Isolation" ON discounts;
CREATE POLICY "Discounts Isolation" ON discounts
    FOR ALL USING (store_id IN (SELECT store_id FROM users WHERE id = auth.uid()));

-- 6. Trigger for bill points
-- Logic: 1 point for every ₹100 spent
CREATE OR REPLACE FUNCTION update_user_loyalty()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET loyalty_points = loyalty_points + FLOOR(NEW.total_amount / 100)
    WHERE store_id = NEW.store_id; -- Simplified for demo
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_loyalty ON bills;
CREATE TRIGGER tr_update_loyalty
AFTER INSERT ON bills
FOR EACH ROW EXECUTE FUNCTION update_user_loyalty();
