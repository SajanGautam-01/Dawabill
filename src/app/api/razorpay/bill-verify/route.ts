import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      // expectedAmount // DO NOT TRUST client supplied values
    } = await req.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      if (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        try {
          // 1. Fetch DB Amount vs Client Payload
          const { data: billData } = await supabaseAdmin
            .from('bills')
            .select('total_amount')
            .eq('external_transaction_id', razorpay_order_id)
            .single();

          const dbAmountInPaise = billData ? Math.round(billData.total_amount * 100) : null;

          // 2. Fetch remote intent reality
          const rzp = new Razorpay({
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });
          const realOrder = await rzp.orders.fetch(razorpay_order_id);
          const paidAmount = Number(realOrder?.amount || 0);
          
          if (!realOrder || !dbAmountInPaise || paidAmount !== dbAmountInPaise) {
            await supabaseAdmin.from('failed_payments').insert({
              order_id: razorpay_order_id,
              reason: `Amount mismatch | expected ${dbAmountInPaise || 'unknown_DB'} | got ${paidAmount} | payment_id ${razorpay_payment_id}`
            });
            return NextResponse.json({ success: false, error: 'Payment verification failed' });
          }
        } catch (fetchErr: any) {
          console.error("Razorpay Fetch Validation Failed:", fetchErr);
          await supabaseAdmin.from('failed_payments').insert({
            order_id: razorpay_order_id,
            reason: `Razorpay fetch failed: ${fetchErr.message || 'API crash'}`
          });
          return NextResponse.json({ success: false, error: 'Failed to securely validate order amount.' });
        }
      }
      return NextResponse.json({ success: true, verified: true });
    } else {
      // 3. Signature Hack Attempt Trapping
      await supabaseAdmin.from('failed_payments').insert({
        order_id: razorpay_order_id,
        reason: `Invalid Razorpay signature | payment_id ${razorpay_payment_id}`
      });
      return NextResponse.json({ success: false, error: 'Payment verification failed' });
    }
  } catch (error: any) {
    console.error('Razorpay Verify Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
