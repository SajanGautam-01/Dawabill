import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    const { storeId, whatsappKey, enableWhatsapp, loyaltyThreshold } = await req.json();

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Update settings securely in the backend
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({
        store_id: storeId,
        whatsapp_api_key: whatsappKey,
        enable_whatsapp_alerts: enableWhatsapp,
        config: { loyalty_threshold: loyaltyThreshold },
        updated_at: new Date().toISOString()
      }, { onConflict: 'store_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Settings updated safely' });
  } catch (error: any) {
    console.error('Settings Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) return NextResponse.json({ error: 'Store ID required' }, { status: 400 });

    try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('enable_whatsapp_alerts, config, whatsapp_api_key')
            .eq('store_id', storeId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Mask the API key before sending to frontend
        const responseData = {
            enable_whatsapp_alerts: data?.enable_whatsapp_alerts || false,
            config: data?.config || { loyalty_threshold: "100" },
            has_whatsapp_key: !!data?.whatsapp_api_key
        };

        return NextResponse.json({ success: true, data: responseData });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
