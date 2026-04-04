import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ─── Phase 1: Auth Gate + Store Resolution Guard ──────────────────────────────
// RULE: Never touch the DB until a confirmed Supabase session exists.
// RULE: setLoading(false) MUST fire in every possible code path.
// RULE: No screen should stay loading > 10 seconds (global hard timeout).

export function useStore() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const hasFetched = useRef(false); // Execution lock — prevents duplicate fetches

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchStore = useCallback(async () => {
    // Execution lock: only run once per mount (auth changes re-trigger via listener)
    if (hasFetched.current) return;
    hasFetched.current = true;

    // ── GLOBAL HARD TIMEOUT: 10 seconds ──────────────────────────────────────
    // Guarantees loading=false no matter what happens below.
    const hardStopTimer = setTimeout(() => {
      if (isMounted.current) {
        console.warn('[useStore] Hard timeout reached. Forcing loading=false.');
        setLoading(false);
        setError('timeout');
      }
    }, 10000);

    try {
      // ── PHASE 1: Auth Gate ────────────────────────────────────────────────
      // DO NOT run any DB query without a confirmed session.
      const { data: { session } } = await supabase.auth.getSession();

      if (!isMounted.current) return;

      if (!session?.user) {
        // No session — user is logged out. Release loading immediately.
        setLoading(false);
        return;
      }

      // ── PHASE 2: Store Resolution ─────────────────────────────────────────
      setUserId(session.user.id);
      const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true';

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('store_id, role')
        .eq('id', session.user.id)
        .single();

      if (!isMounted.current) return;

      if (fetchError) {
        console.warn('[useStore] Store fetch failed:', fetchError.message);

        if (isTestingMode) {
          // Testing mode fallback: find any store
          const { data: anyStore } = await supabase
            .from('stores')
            .select('id')
            .limit(1)
            .maybeSingle();

          if (isMounted.current) {
            setStoreId(anyStore?.id || '00000000-0000-0000-0000-000000000000');
            setUserRole('admin');
            setError(null);
            setLoading(false); // ← GUARANTEED
          }
        } else {
          // Production: surface the error and release loading
          setError('connection_error');
          setLoading(false); // ← GUARANTEED
        }
      } else if (data) {
        // Resolve Store Identity (Elite Addition)
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', data.store_id)
          .maybeSingle();

        if (isMounted.current) {
          setStoreId(data.store_id);
          setStoreName(storeData?.name || 'Local Pharmacy');
          setUserRole(data.role);
          setError(null);
          setLoading(false); 
        }
      } else {
        // data is null (no row for this user)
        if (isMounted.current) {
          setError('store_not_found');
          setLoading(false); 
        }
      }
    } catch (err) {
      console.error('[useStore] Critical error:', err);
      if (isMounted.current) {
        setError('critical_error');
        setLoading(false); // ← GUARANTEED
      }
    } finally {
      clearTimeout(hardStopTimer);
    }
  }, []);

  useEffect(() => {
    fetchStore();

    // Re-fetch on every sign-in event (e.g., after returning from login page)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Reset lock so the next fetchStore call proceeds
        hasFetched.current = false;
        setLoading(true);
        setStoreId(null);
        setUserId(null);
        setUserRole(null);
        setError(null);
        fetchStore();
      }
      if (event === 'SIGNED_OUT') {
        if (isMounted.current) {
          setStoreId(null);
          setUserId(null);
          setUserRole(null);
          setLoading(false);
          setError(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchStore]);

  return { storeId, storeName, userId, userRole, loading, error };
}
