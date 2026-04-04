import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Razorpay Webhook Handler — Subscription Fulfillment Fail-Safe
 * Route: POST /api/razorpay/webhook/subscription
 * 
 * Ensures that subscriptions are activated even if the user closes the 
 * browser before the frontend verification completes.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature');
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  // ── 1. Signature Verification ───────────────────────────────────────────
  if (webhookSecret) {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[Webhook] Invalid Webhook Signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    console.warn('[Webhook] Warning: RAZORPAY_WEBHOOK_SECRET not configured. Security degraded.');
  }

  try {
    const payload = JSON.parse(body);
    const event = payload.event;

    // We only care about payment.captured for core fulfillment
    if (event !== 'payment.captured') {
      return NextResponse.json({ received: true });
    }

    const payment = payload.payload.payment.entity;
    const { 
      id: payment_id, 
      order_id, 
      amount, 
      currency, 
      status, 
      notes 
    } = payment;

    const { 
      store_id, 
      plan_id, 
      billing_cycle, 
      user_id 
    } = notes || {};

    // ── 2. Input Validation ────────────────────────────────────────────────
    if (!payment_id || !order_id || !store_id || !plan_id || !billing_cycle || !user_id) {
      console.warn('[Webhook] Missing required notes for fulfillment:', payment_id);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 200 }); // Return 200 to acknowledge receipt
    }

    // ── 3. Zero-Tolerance Consistency Audit ────────────────────────────────
    if (status !== 'captured' || currency !== 'INR') {
      console.error('[Webhook] Audit Failure: Invalid status/currency');
      return NextResponse.json({ error: 'Audit failure' }, { status: 200 });
    }

    // ── 4. Authoritative Plan Fetch ────────────────────────────────────────
    const { data: dbPlan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !dbPlan) {
      console.error('[Webhook] Resolved plan missing from registry:', plan_id);
      return NextResponse.json({ error: 'Plan not found' }, { status: 200 });
    }

    // ── 5. Amount Validation (Rupees to Paise) ─────────────────────────────
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    const isTestMode = keyId.startsWith('rzp_test_');
    
    const expectedRupees = billing_cycle === 'yearly' 
      ? Math.floor(Number(dbPlan.price) * 12 * 0.8) 
      : Number(dbPlan.price);
    
    const expectedPaise = expectedRupees * 100;

    // Allow ₹1 (100 paise) ONLY in test mode
    const isAmountValid = (isTestMode && amount === 100) || (amount >= expectedPaise);

    if (!isAmountValid) {
      console.error('[Webhook] Final Revenue Leak Blocked:', { amount, expectedPaise });
      return NextResponse.json({ error: 'Amount discrepancy' }, { status: 200 });
    }

    // ── 6. Atomic Fulfillment ──────────────────────────────────────────────
    const planDays = billing_cycle === 'yearly' ? 365 : 30;

    const { data: rpcResponse, error: rpcError } = await supabaseAdmin.rpc('fulfill_subscription_payment_v3', {
      p_store_id: store_id,
      p_user_id: user_id,
      p_plan_id: dbPlan.id,
      p_days: planDays,
      p_order_id: order_id,
      p_payment_id: payment_id
    });

    if (rpcError || !rpcResponse?.success) {
      console.error('[Webhook] Fulfillment Failure:', rpcError?.message || rpcResponse?.error);
      return NextResponse.json({ error: 'RPC Failure' }, { status: 200 });
    }

    console.log('[Webhook] Subscription Fulfilled Successfully:', payment_id);
    return NextResponse.json({ success: true, idempotent: rpcResponse.idempotent });

  } catch (err: any) {
    console.error('[Webhook] Fatal Exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
