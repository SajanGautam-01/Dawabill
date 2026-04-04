-- ==========================================
-- ELITE PRODUCTION HARDENING: PHASE 4
-- Atomic Fulfillment (Settlement Logic)
-- ==========================================

-- This script ensures subscription payments are credited exactly once.
-- It handles early renewals, trial termination, and audit logging.

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
    -- 🛡️ 1. CONCURRENCY PROTECTION
    -- Sequentializes multiple calls for the same store.
    PERFORM pg_advisory_xact_lock(hashtext(p_store_id::text));

    -- 🛡️ 2. IDEMPOTENCY CHECK
    -- Prevent duplicate execution for the same Razorpay Order.
    SELECT last_payment_order_id INTO v_existing_order
    FROM public.subscriptions WHERE store_id = p_store_id FOR UPDATE;

    IF v_existing_order = p_order_id THEN
        RETURN jsonb_build_object(
            'success', true, 
            'idempotent', true, 
            'message', 'Payment already fulfilled.'
        );
    END IF;

    -- 🛡️ 3. RESOLVE EXPIRY LOGIC (Prepaid Time Preservation)
    -- If already active, start the new duration from the EXISTING expiry date.
    -- If expired or missing, start from NOW.
    SELECT expiry_date INTO v_current_expiry FROM public.subscriptions WHERE store_id = p_store_id;
    
    v_new_expiry := GREATEST(COALESCE(v_current_expiry, CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + (p_days * INTERVAL '1 day');

    -- 🛡️ 4. ATOMIC STATE UPDATES
    INSERT INTO public.subscriptions (store_id, plan_id, expiry_date, status, last_payment_order_id, last_payment_id)
    VALUES (p_store_id, p_plan_id, v_new_expiry, 'active', p_order_id, p_payment_id)
    ON CONFLICT (store_id) DO UPDATE SET
        plan_id = p_plan_id,
        expiry_date = v_new_expiry,
        status = 'active',
        last_payment_order_id = p_order_id,
        last_payment_id = p_payment_id,
        trial_end = NULL; -- Terminate trial if active

    -- Mark trial as used on the user profile
    UPDATE public.users SET trial_used = true WHERE id = p_user_id AND trial_used = false;

    -- 🛡️ 5. SUCCESS AUDIT LOG
    INSERT INTO public.audit_logs (store_id, action, severity, metadata)
    VALUES (p_store_id, 'SUBSCRIPTION_FULFILLED_V3', 'info', jsonb_build_object(
        'plan_id', p_plan_id, 
        'days', p_days, 
        'new_expiry', v_new_expiry,
        'order_id', p_order_id,
        'payment_id', p_payment_id
    ));

    RETURN jsonb_build_object('success', true, 'expiry_date', v_new_expiry, 'status', 'active');

EXCEPTION WHEN OTHERS THEN
    -- Audit failure
    INSERT INTO public.audit_logs (store_id, action, severity, metadata)
    VALUES (p_store_id, 'FULFILLMENT_FAILED_V3', 'error', jsonb_build_object('error', SQLERRM, 'order_id', p_order_id));
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Summary: Fulfillment is now atomic, idempotent, and trial-aware.
