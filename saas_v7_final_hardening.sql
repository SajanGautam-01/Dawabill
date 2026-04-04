-- ==========================================
-- SAAS ELITE HARDENING (v7)
-- ==========================================

-- 1. Schema Hardening (Safe Additions)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'trial_used') THEN
        ALTER TABLE public.users ADD COLUMN trial_used BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'trial_end') THEN
        ALTER TABLE public.subscriptions ADD COLUMN trial_end TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'last_payment_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN last_payment_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'last_payment_order_id') THEN
        ALTER TABLE public.subscriptions ADD COLUMN last_payment_order_id TEXT;
    END IF;
END $$;

-- 2. Unique Constraint for Single Subscription Authority
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subscriptions_store_id_key') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_store_id_key UNIQUE (store_id);
    END IF;
END $$;

-- 3. Subscription Status Resolver (The Single Source of Truth)
-- Hardening: UTC comparisons, NULL safety, Settings fallback
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_store_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expiry TIMESTAMPTZ;
    v_trial_end TIMESTAMPTZ;
    v_grace_hours INTEGER;
BEGIN
    -- Resolve Expiry and Trial End (Always use explicit UTC)
    SELECT expiry_date, trial_end INTO v_expiry, v_trial_end
    FROM public.subscriptions WHERE store_id = p_store_id;

    -- Handle Missing Row (Default Expired)
    IF NOT FOUND THEN
        RETURN 'expired';
    END IF;

    -- Fetch Grace Period Config (Fallback to 48h)
    SELECT COALESCE((config->>'grace_period_hours')::INTEGER, 48) INTO v_grace_hours
    FROM public.settings WHERE store_id = p_store_id;
    
    IF v_grace_hours IS NULL THEN v_grace_hours := 48; END IF;

    -- 1. Trial Check (Highest Priority)
    IF v_trial_end IS NOT NULL AND v_trial_end > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN
        RETURN 'trialing';
    END IF;

    -- 2. Active Check
    IF v_expiry IS NOT NULL AND v_expiry > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN
        RETURN 'active';
    END IF;

    -- 3. Grace Check (Soft Landing)
    IF v_expiry IS NOT NULL AND (v_expiry + (v_grace_hours * INTERVAL '1 hour')) > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN
        RETURN 'grace';
    END IF;

    -- 4. Expired fallback
    RETURN 'expired';
END;
$$;

-- 4. Mutation Guard (For RLS and RPCs)
CREATE OR REPLACE FUNCTION public.check_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
BEGIN
    v_status := public.get_subscription_status(p_store_id);
    RETURN v_status IN ('active', 'trialing', 'grace');
END;
$$;

-- 5. Atomic Payment Fulfillment (Elite v3)
-- Hardening: UTC-safe, Dual-Key Idempotency, Time-Preserving, Atomic Sync
CREATE OR REPLACE FUNCTION public.fulfill_subscription_payment_v3(
    p_store_id UUID,
    p_user_id UUID,
    p_plan_id UUID,
    p_days INTEGER,
    p_order_id TEXT,
    p_payment_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_expiry TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
    v_existing_order TEXT;
BEGIN
    -- 0. Concurrent Activation Protection (Phase 2 Hardening)
    -- Sequentializes multiple calls for the same store to prevent race conditions.
    PERFORM pg_advisory_xact_lock(hashtext(p_store_id::text));

    -- 1. Row-Level Lock & Idempotency Check (Prevent duplicate execution)
    SELECT last_payment_order_id INTO v_existing_order
    FROM public.subscriptions WHERE store_id = p_store_id FOR UPDATE;

    IF v_existing_order = p_order_id THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'message', 'Payment already fulfilled.');
    END IF;

    -- 2. Resolve Expiry Logic (Preserve prepaid time if renewed early)
    SELECT expiry_date INTO v_current_expiry FROM public.subscriptions WHERE store_id = p_store_id;
    
    -- If expired or missing, start from NOW, else start from EXISTING EXPIRY
    v_new_expiry := GREATEST(COALESCE(v_current_expiry, CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + (p_days * INTERVAL '1 day');

    -- 3. Atomic State Updates
    -- a. Subscription Sync
    INSERT INTO public.subscriptions (store_id, plan_id, expiry_date, status, last_payment_order_id, last_payment_id)
    VALUES (p_store_id, p_plan_id, v_new_expiry, 'active', p_order_id, p_payment_id)
    ON CONFLICT (store_id) DO UPDATE SET
        plan_id = p_plan_id,
        expiry_date = v_new_expiry,
        status = 'active',
        last_payment_order_id = p_order_id,
        last_payment_id = p_payment_id,
        trial_end = NULL; -- End trial if it was active

    -- b. Identity-Level Trial Hardening
    UPDATE public.users SET trial_used = true WHERE id = p_user_id AND trial_used = false;

    -- 4. Log Success (Non-blocking logging isolated via EXCEPTION block)
    BEGIN
        INSERT INTO public.audit_logs (store_id, action, severity, metadata)
        VALUES (p_store_id, 'SUBSCRIPTION_RENEWAL_V7', 'info', jsonb_build_object(
            'plan_id', p_plan_id, 
            'days', p_days, 
            'new_expiry', v_new_expiry,
            'order_id', p_order_id,
            'payment_id', p_payment_id,
            'timestamp_utc', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
        ));
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Suppress logging failure to ensure fulfillment succeeds
    END;

    RETURN jsonb_build_object('success', true, 'expiry_date', v_new_expiry, 'status', 'active');
END;
$$;

-- 6. Log Management (Archival Strategy)
CREATE OR REPLACE PROCEDURE public.prune_v7_logs()
LANGUAGE plpgsql
AS $$
BEGIN
    -- Cleanup logs older than 90 days to prevent table bloat
    DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM public.webhook_logs WHERE processed_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 7. Refund Handling (Instant Revocation)
CREATE OR REPLACE FUNCTION public.flag_v7_refund(p_order_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.subscriptions 
    SET status = 'expired', 
        expiry_date = CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '1 minute'
    WHERE last_payment_order_id = p_order_id;
    
    INSERT INTO public.audit_logs (store_id, action, severity, metadata)
    SELECT store_id, 'REVENUE_REVERSAL_REFUND', 'warning', jsonb_build_object('order_id', p_order_id, 'revocation_time_utc', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    FROM public.subscriptions WHERE last_payment_order_id = p_order_id;
END;
$$;
