import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Support either single array multi-select OR traditional fallback purely cleanly natively
    const billIds = body.billIds || (body.bill_id ? [body.bill_id] : null);
    
    if (!billIds || !Array.isArray(billIds) || billIds.length === 0) {
      return NextResponse.json({ error: 'Array of Bill IDs required.' }, { status: 400 });
    }

    // We instantiate the service key manually to bypass RLS for this specific atomic admin operation safely.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Call the newly created atomic RPC protecting cross-node limitations dynamically
    const { data, error } = await supabaseAdmin.rpc('refund_bills_batch_v1', { p_bill_ids: billIds });

    if (error) {
       console.error("Refund Batch RPC Execution Failed", error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || !data.success) {
       return NextResponse.json({ error: data?.error || 'Unknown batch error mapping cleanly natively' }, { status: 400 });
    }

    return NextResponse.json({ success: true, count: billIds.length });
  } catch (err: any) {
    console.error("Refund API Error", err);
    return NextResponse.json({ error: err.message || 'Fatal Server Exception' }, { status: 500 });
  }
}
