import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(5, '10 s'),
    analytics: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (ratelimit) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      const { success } = await ratelimit.limit(`webhook_${ip}`);
      if (!success) {
        return NextResponse.json({ error: "Too Many Requests. Webhook Edge Throttled." }, { status: 429 });
      }
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature === expectedSignature) {
      const event = JSON.parse(rawBody);
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );

      // 1. Log the incoming event for audit trail
      await supabaseAdmin.from('webhook_logs').insert({
        event_id: event.id,
        event_type: event.event,
        payload: event
      });

      // 2. Handle Payment Captured
      if (event.event === 'payment.captured') {
        const orderId = event.payload?.payment?.entity?.order_id;
        if (orderId) {
          await supabaseAdmin
            .from('bills')
            .update({ payment_status: 'paid' })
            .eq('external_transaction_id', orderId);
        }
      } else if (event.event === 'payment.failed') {
        const orderId = event.payload?.payment?.entity?.order_id;
        const errorReason = event.payload?.payment?.entity?.error_description || 'Unknown webhook validation failure';
        
        if (orderId) {
          // Relies on failed_payments table existence matching Task 3 specs
          await supabaseAdmin.from('failed_payments').insert({
            order_id: orderId,
            reason: errorReason,
            created_at: new Date().toISOString()
          });
        }
      }
      
      return NextResponse.json({ status: 'ok' });
    } else {
      return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
