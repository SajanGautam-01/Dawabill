import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { storeId, action, severity, metadata } = await req.json();

    if (!storeId || !action) {
      return NextResponse.json({ error: 'Missing log data' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        store_id: storeId,
        action,
        severity: severity || 'info',
        metadata: metadata || {}
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Audit Log Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
