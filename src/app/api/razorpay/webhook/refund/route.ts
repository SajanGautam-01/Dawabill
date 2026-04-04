import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * DawaBill — Razorpay Webhook Handler (Refunds & Security)
 * Route: POST /api/razorpay/webhook/refund
 *
 * SAFE LAYER: Isolated endpoint for automated revenue protection.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // ── 1. Security Gate (Signature Verification) ───────────────────────────
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      if (expectedSignature !== signature) {
        console.error('[webhook-refund] Invalid signature detected.');
        return NextResponse.json({ error: 'Tampered webhook rejected.' }, { status: 403 });
      }
    } else if (!webhookSecret) {
      console.warn('[webhook-refund] WARNING: WEBHOOK_SECRET missing. Revenue safety degraded.');
    }

    const { event, payload } = body;

    // ── 2. Event Routing ────────────────────────────────────────────────────
    if (event === 'payment.refunded' || event === 'order.cancelled') {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      if (!orderId) {
        return NextResponse.json({ error: 'No order_id in payload.' }, { status: 400 });
      }

      console.log(`[webhook-refund] Revoking subscription for Order: ${orderId}`);

      // Atomically revoke using the Elite v7 RPC
      const { error: rpcError } = await supabaseAdmin.rpc('flag_v7_refund', {
        p_order_id: orderId
      });

      if (rpcError) {
        console.error('[webhook-refund] Revocation RPC Error:', rpcError.message);
        return NextResponse.json({ error: 'Internal revocation fault.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'revoked' });
    }

    // Acknowledge other events but do nothing
    return NextResponse.json({ success: true, action: 'ignored' });

  } catch (error: any) {
    console.error('[webhook-refund] Fatal Webhook Exception:', error);
    return NextResponse.json({ error: 'Internal system failure.' }, { status: 500 });
  }
}
