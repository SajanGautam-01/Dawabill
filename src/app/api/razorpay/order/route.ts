import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { amount, storeId, planId, userId, billingCycle } = await req.json();
    const key_id = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '').trim();
    const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

    if (!key_id || !key_secret) {
        console.error("Razorpay keys missing or empty.");
        return NextResponse.json({ 
          success: false, 
          error: "Razorpay configuration missing. Please check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." 
        }, { status: 500 });
    }

    const razorpay = new Razorpay({ key_id, key_secret });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // amount in paisa
      currency: "INR",
      receipt: `receipt_${Date.now()}_${storeId.slice(0, 8)}`,
      notes: {
        plan_id: planId,
        user_id: userId,
        billing_cycle: billingCycle,
        store_id: storeId
      }
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Razorpay Order Error:', error);
    // Return mock on error to prevent total system failure (Phase 1)
    return NextResponse.json({ 
      success: true, 
      order: { id: `order_error_mock_${Date.now()}`, amount: 0, currency: "INR" },
      error: error.message
    });
  }
}
