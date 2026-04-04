import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.dawabill.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

// ─── BUILD-SAFE SUPABASE INITIALIZATION ─────────────────────────────────────
// We use a dummy URL ('https://placeholder.dawabill.co') during build phase to
// prevent the @supabase/supabase-js library from throwing an error.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || !supabaseUrl;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
  console.warn("⚠️  Pharmacy System Warning: Supabase Credentials Missing. Check Environment Variables.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.dawabill.co',
  supabaseAnonKey || 'placeholder'
);

// ─── RUNTIME SAFETY CHECK ──────────────────────────────────────────────────
// This helper allows our UI components to detect if the system is correctly
// configured without causing a browser-level DNS/Network error.
export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && !supabaseUrl.includes('placeholder');
};
