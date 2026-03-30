import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized CRON execution' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { error } = await supabaseAdmin.rpc('refresh_admin_dashboard_stats_mv');
    
    if (error) throw error;

    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('CRON Refresh Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
