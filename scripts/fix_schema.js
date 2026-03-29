const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSchema() {
  console.log("Adding updated_at to subscriptions...");
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();'
  });
  
  if (error) {
    console.error("Error:", error);
    // Fallback if exec_sql RPC is missing
    console.log("Standard SQL execution failed. Please run the SQL manually in Supabase Dashboard.");
  } else {
    console.log("Schema updated successfully.");
  }
}

fixSchema();
