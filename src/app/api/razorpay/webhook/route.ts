import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
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
