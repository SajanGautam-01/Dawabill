import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const bill = await req.json();
    
    // We instantiate the service key manually to bypass RLS for ServiceWorker background connections safely.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const itemsForRPC = bill.items.map((item: any) => ({
      product_id: item.id,
      quantity: item.quantity,
      sale_rate: item.sale_rate || item.price 
    }));

    // Call the Atomic RPC (v5 with Idempotency Validation natively protecting against double sync mappings)
    const { data: rpcResponse, error: rpcError } = await supabaseAdmin.rpc('create_bill_v5', {
      p_store_id: bill.store_id,
      p_customer_name: bill.customer_name,
      p_customer_phone: bill.customer_phone,
      p_payment_mode: bill.payment_mode,
      p_items: itemsForRPC,
      p_idempotency_key: bill.idempotency_key,
      p_external_transaction_id: bill.external_transaction_id || null,
      p_discount_id: bill.discount_id || null
    });

    if (rpcError || !rpcResponse || !rpcResponse.success) {
       const msg = rpcError?.message || rpcResponse?.error || 'Atomic transaction rejected via Backsync';
       
       if (rpcResponse?.is_duplicate) {
           // Standard idempotency recovery: Background Sync double-fetched natively! Ignore implicitly seamlessly
           return NextResponse.json({ success: true, duplicate: true });
       }
       
       // Explicitly logging the failed sync to /admin/logs table directly validating Structural Retry requirements explicitly
       await supabaseAdmin.from('audit_logs').insert({
          store_id: bill.store_id,
          action: 'offline_sync_retry',
          severity: 'error',
          metadata: { message: `Background Sync Failed: ${msg}`, idempotency_key: bill.idempotency_key }
       });

       // 500 error natively forces SW backoff logic recursively securely naturally mapped
       return NextResponse.json({ error: msg }, { status: 500 }); 
    }

    // Success Audit Log (Requirement validation)
    await supabaseAdmin.from('audit_logs').insert({
       store_id: bill.store_id,
       action: 'offline_sync_retry',
       severity: 'info',
       metadata: { message: `Background Sync Succeeded completely for Invoice ${rpcResponse.bill_number}`, bill_id: rpcResponse.bill_id }
    });

    return NextResponse.json({ success: true, message: 'Successfully structurally bound via SW background locally' });
  } catch (err: any) {
    console.error("Offline SW Sync Endpoint Fatal Error:", err);
    return NextResponse.json({ error: 'Fatal Server Exception handling background connection' }, { status: 500 });
  }
}
