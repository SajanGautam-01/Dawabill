-- ==========================================
-- ELITE PRODUCTION HARDENING: PHASE 1
-- Identity & Subscription Schema Improvements
-- ==========================================

-- This script safely adds missing columns to your production database.
-- It is idempotent (can be run multiple times safely).

DO $$ 
BEGIN
    -- 1. Identity Level: Track if a user has already used their trial
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'trial_used') THEN
        ALTER TABLE public.users ADD COLUMN trial_used BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added Column: users.trial_used';
    END IF;

    -- 2. Subscription Level: Track the latest payment for recovery
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'last_payment_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN last_payment_id TEXT;
        RAISE NOTICE 'Added Column: subscriptions.last_payment_id';
    END IF;

    -- 3. Billing Level: Absolute Idempotency Protection
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'idempotency_key') THEN
        ALTER TABLE public.bills ADD COLUMN idempotency_key TEXT UNIQUE;
        RAISE NOTICE 'Added Column: bills.idempotency_key';
    END IF;

    -- 4. Subscription Level: Track trial end dates explicitly
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'trial_end') THEN
        ALTER TABLE public.subscriptions ADD COLUMN trial_end TIMESTAMPTZ;
        RAISE NOTICE 'Added Column: subscriptions.trial_end';
    END IF;

END $$;

-- Summary: All required columns for production stability are now ready.
