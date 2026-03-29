import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fail-fast Environment Validation for Production Debugging
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  const errorMsg = "FATAL: Supabase Credentials Missing or Invalid. Check Vercel/Local Environment Variables.";
  console.error(errorMsg);
  
  // During build phase, we allow the client to be empty to prevent build failure
  // but in actual runtime, we need these to be present.
  if (process.env.NEXT_PHASE !== 'phase-production-build' && typeof window !== 'undefined') {
    throw new Error(errorMsg);
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', // Dummy for build safety
  supabaseAnonKey || 'placeholder'
);
