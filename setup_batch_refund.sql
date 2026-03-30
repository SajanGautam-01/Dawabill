-- Execute this natively inside your Supabase SQL Editor
-- This ensures arrays of UUIDs are strictly processed as a single, absolute atomic transaction natively protecting the store inventory loops completely safely.

CREATE OR REPLACE FUNCTION refund_bills_batch_v1(p_bill_ids UUID[])
RETURNS json
AS $$
DECLARE
    current_bill_id UUID;
    v_result json;
    v_has_refunded BOOLEAN := false;
BEGIN
    -- Loop across the provided UUID array securely natively catching limits implicitly
    FOREACH current_bill_id IN ARRAY p_bill_ids LOOP
        
        -- Execute the previously deployed single refund securely avoiding repetition structural definitions
        -- This inherently triggers the sub-routine restocking maps automatically
        v_result := refund_bill_v1(current_bill_id);
        
        -- Analyze the JSON return object ensuring the sub-transaction committed
        IF (v_result->>'success') = 'false' OR (v_result->>'error') IS NOT NULL THEN
            -- RAISING EXCEPTION inherently halts the array map, destroying local uncommitted state instantly natively
            RAISE EXCEPTION 'Refund Batch Fault for %: %', current_bill_id, COALESCE(v_result->>'error', 'Unknown Sub-Failure');
        END IF;

        v_has_refunded := true;
        
    END LOOP;

    IF v_has_refunded THEN
        RETURN json_build_object('success', true);
    ELSE
        RETURN json_build_object('success', false, 'error', 'No bills extracted structurally');
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- In Postgres, raising an exception rolls back the ENTIRE loop seamlessly natively mapping safety blocks safely natively
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
