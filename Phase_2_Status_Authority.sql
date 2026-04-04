-- ==========================================
-- ELITE PRODUCTION HARDENING: PHASE 2
-- Status Authority (Single Source of Truth)
-- ==========================================

-- This script creates the authoritative subscription status function.
-- It handles Trials, Expiry, and Grace Periods with UTC safety.

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
    -- 1. Fetch Subscription Data
    SELECT expiry_date, trial_end INTO v_expiry, v_trial_end
    FROM public.subscriptions WHERE store_id = p_store_id;

    -- 2. Handle missing record (Default Expired)
    IF NOT FOUND THEN
        RETURN 'expired';
    END IF;

    -- 3. Fetch Grace Period (Fallback to 48h)
    -- We look for 'grace_period_hours' in the settings table if it exists
    BEGIN
        SELECT COALESCE((config->>'grace_period_hours')::INTEGER, 48) INTO v_grace_hours
        FROM public.settings WHERE store_id = p_store_id;
    EXCEPTION WHEN OTHERS THEN
        v_grace_hours := 48;
    END;
    
    IF v_grace_hours IS NULL THEN v_grace_hours := 48; END IF;

    -- 4. Status Check Priorities:
    
    -- PRIORITY 1: Trial (Highest)
    -- If trial_end is in the future, the user is 'trialing'
    IF v_trial_end IS NOT NULL AND v_trial_end > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN
        RETURN 'trialing';
    END IF;

    -- PRIORITY 2: Active
    -- If expiry_date is in the future, the user is 'active'
    IF v_expiry IS NOT NULL AND v_expiry > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN
        RETURN 'active';
    END IF;

    -- PRIORITY 3: Grace Period
    -- If expired but within grace hours, the user is in 'grace'
    IF v_expiry IS NOT NULL AND (v_expiry + (v_grace_hours * INTERVAL '1 hour')) > CURRENT_TIMESTAMP AT TIME ZONE 'UTC' THEN
        RETURN 'grace';
    END IF;

    -- DEFAULT: Expired
    RETURN 'expired';
END;
$$;

-- Helper Function (Boolean guard for RLS/Billing)
CREATE OR REPLACE FUNCTION public.check_subscription_active(p_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.get_subscription_status(p_store_id) IN ('active', 'trialing', 'grace');
END;
$$;

-- Summary: All status checks are now authoritative and centralized.
