-- Enable UUID extension if not already done
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Stores (Foundation Table - MUST BE FIRST)
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    gst_no TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users (Links Supabase auth.users to stores)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'admin', -- 'admin' or 'staff'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Plans (Global Table, No store_id)
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    features JSONB
);

-- 4. Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES plans(id) NOT NULL,
    status TEXT DEFAULT 'active',
    start_date TIMESTAMPTZ DEFAULT NOW(),
    expiry_date TIMESTAMPTZ NOT NULL
);

-- 5. Settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE UNIQUE NOT NULL,
    invoice_prefix TEXT DEFAULT 'INV-',
    default_gst_rate DECIMAL(5,2) DEFAULT 0,
    config JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Payment Accounts (Multi-UPI support)
CREATE TABLE payment_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    upi_id TEXT NOT NULL,
    display_name TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Products (Inventory including batch and expiry)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    mrp DECIMAL(10,2) NOT NULL DEFAULT 0,
    purchase_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    sale_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Bills
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    bill_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_mode TEXT DEFAULT 'cash',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Bill Items
CREATE TABLE bill_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Support Tickets
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Deleted Items (for the 7-day recovery bin)
CREATE TABLE deleted_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
    table_name TEXT NOT NULL,
    original_id UUID NOT NULL,
    data JSONB NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) configuration
-- ==========================================

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_items ENABLE ROW LEVEL SECURITY;

-- Note: RLS Policies for full data isolation by tenant.
-- e.g., CREATE POLICY "Tenant Isolation" ON products FOR ALL USING (store_id = (SELECT store_id FROM users WHERE id = auth.uid()));
