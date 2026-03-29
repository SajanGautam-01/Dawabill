import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      expectedAmount 
    } = await req.json();

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Signature is valid
      // In a real app, we'd also check if the amount matches the order from Razorpay API
      return NextResponse.json({ success: true, verified: true });
    } else {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Razorpay Verify Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
