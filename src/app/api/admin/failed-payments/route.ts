import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabaseAdmin
      .from('failed_payments')
      .select('id, order_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error("Failed Payments API Error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ payments: data || [] });

  } catch (err: any) {
    console.error("Failed Payments API Fatal", err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
