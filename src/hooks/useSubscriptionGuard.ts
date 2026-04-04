import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from './useStore';
import { supabase } from '@/lib/supabaseClient';

// ─── In-memory payment dedup cache ────────────────────────────────────────────
const handledPaymentsSet = new Set<string>();
const processingPaymentsSet = new Set<string>();

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_RECOVERY_ATTEMPTS = 3;
const ACTIVATING_HARD_STOP_MS = 8000;  // Phase 4: hard stop on "Activating..." screen
const GLOBAL_LOADING_TIMEOUT_MS = 10000; // Phase 7: global failsafe

export function useSubscriptionGuard() {
  const { storeId, loading: storeLoading } = useStore();

  // ── Auth gate state ─────────────────────────────────────────────────────────
  // Phase 1: Block ALL subscription logic until auth is confirmed.
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [hoursInGracePeriod, setHoursInGracePeriod] = useState<number | null>(null);
  const [status, setStatus] = useState<'trial' | 'active' | 'expired'>('expired');
  const [planName, setPlanName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [hasError, setHasError] = useState(false);

  const isMounted = useRef(true);
  const hasCheckedBackground = useRef(false);
  const recoveryInProgress = useRef(false);

  // ── Phase 3: Synchronous execution lock ─────────────────────────────────────
  // useRef is synchronous unlike useState — prevents duplicate concurrent calls
  // even before React batches the isSyncing state update.
  const isCheckingRef = useRef(false);

  // ── Phase 4: Activating screen hard-stop timer ──────────────────────────────
  const activatingHardStopTimer = useRef<NodeJS.Timeout | null>(null);

  const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true';

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (activatingHardStopTimer.current) {
        clearTimeout(activatingHardStopTimer.current);
      }
    };
  }, []);

  // ── PHASE 1: Auth gate ──────────────────────────────────────────────────────
  // Run ONCE at mount. Confirm session exists before ANY subscription logic.
  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled || !isMounted.current) return;

        if (session?.user) {
          setAuthReady(true);
        } else {
          // No session: not logged in. Release everything immediately.
          setAuthReady(false);
          setLoading(false);
          setIsAllowed(false);
        }
      } catch {
        if (!cancelled && isMounted.current) {
          setAuthReady(false);
          setLoading(false);
          setIsAllowed(false);
        }
      } finally {
        if (!cancelled && isMounted.current) {
          setAuthLoading(false);
        }
      }
    };
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // ── Core subscription sync ──────────────────────────────────────────────────
  // manual=true: user-initiated call (e.g. subscription page polling loop).
  // It force-resets the execution lock so polling is never silently dropped.
  const syncSubscription = useCallback(async (force = false, manual = false) => {
    // ── PHASE 1 GATE: Auth must be ready ──────────────────────────────────────
    if (!authReady) return;

    // ── PHASE 2 GATE: Store must be valid ─────────────────────────────────────
    if (storeLoading || !storeId) return;

    // ── PHASE 3 GATE: Execution lock (synchronous ref — not async state) ──────
    // Manual (user-initiated) calls override the lock — they release and re-acquire.
    // Auto-triggered internal calls (bg re-check, session recovery) respect the lock.
    if (isCheckingRef.current) {
      if (manual) {
        console.log('[SubscriptionGuard] Manual sync overriding execution lock.');
        isCheckingRef.current = false; // Force-reset for user-initiated call
      } else {
        console.warn('[SubscriptionGuard] Blocked duplicate auto-call (executionLock active).');
        return;
      }
    }

    if (force && !manual && (recoveryInProgress.current || recoveryAttempts >= MAX_RECOVERY_ATTEMPTS)) {
      console.warn('[SubscriptionGuard] Recovery locked or limit reached.', {
        recoveryInProgress: recoveryInProgress.current,
        recoveryAttempts,
      });
      setHasError(true);
      setLoading(false);
      setIsSyncing(false);
      return;
    }

    // Acquire execution lock
    isCheckingRef.current = true;

    try {
      if (force) {
        recoveryInProgress.current = true;
        setIsSyncing(true);
        setRecoveryAttempts(prev => prev + 1);

        // ── PHASE 4: Hard stop on "Activating..." screen ────────────────────
        if (activatingHardStopTimer.current) {
          clearTimeout(activatingHardStopTimer.current);
        }
        activatingHardStopTimer.current = setTimeout(() => {
          if (!isMounted.current) return;
          console.warn('[SubscriptionGuard] Activating hard stop (8s). Forcing exit.');
          setIsSyncing(false);
          recoveryInProgress.current = false;
          setLoading(false);
          // If still not allowed after hard stop, mark error
          setIsAllowed(prev => {
            if (prev === null || prev === false) setHasError(true);
            return prev;
          });
        }, ACTIVATING_HARD_STOP_MS);
      }

      setLoading(true);
      setHasError(false);

      // ── Subscription Verification Sync: RPC Master Call ──────────────────
      // This RPC handles Trial end, Expiry, and Grace Periods atomically.
      const { data: statusStr, error: rpcError } = await supabase
        .rpc('get_subscription_status', { p_store_id: storeId });

      if (rpcError || !statusStr) throw new Error(`Status Verification Fault: ${rpcError?.message}`);

      // Fetch metadata (Plan Names) in parallel
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('expiry_date, last_payment_id, plans(name)')
        .eq('store_id', storeId)
        .maybeSingle();

      if (!isMounted.current) return;

      const isCurrentlyActive = ['active', 'trialing', 'grace'].includes(statusStr);
      const expiryDate = sub?.expiry_date || new Date().toISOString();
      const planNameVal = (sub?.plans as any)?.name || 'Starter';

      // ── Status Propagation ───────────────────────────────────────────────
      setStatus(statusStr as any);
      setIsAllowed(isCurrentlyActive);
      setPlanName(planNameVal);

      if (isCurrentlyActive) {
        localStorage.setItem('dawabill_last_active_at', new Date().toISOString());
        localStorage.setItem('dawabill_last_status', statusStr);
      }

      // Cleanup processing set if a payment was resolved
      if (sub?.last_payment_id) {
        processingPaymentsSet.delete(sub.last_payment_id);
        handledPaymentsSet.add(sub.last_payment_id);
      }

      return { status: statusStr as any, expiry_date: expiryDate };

    } catch (err) {
      console.error('[SubscriptionGuard] Sync error (attempting ghost recovery):', err);

      const lastActiveAt = localStorage.getItem('dawabill_last_active_at');
      const lastStatus = localStorage.getItem('dawabill_last_status');

      if (lastActiveAt && lastStatus === 'active') {
        const lastActiveDate = new Date(lastActiveAt);
        const hoursSinceActive =
          (new Date().getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceActive < 48) {
          console.warn('[SubscriptionGuard] Offline access preservation — 48h grace granted.');
          if (isMounted.current) {
            setIsAllowed(true);
            setStatus('active');
            setPlanName('Professional');
          }
          return { status: 'active', offline: true };
        }
      }

      if (isMounted.current) {
        setIsAllowed(false);
        setHasError(true);
      }

      // Cleanup processing set on failure
      try {
        const { data: currentSub } = await supabase
          .from('subscriptions')
          .select('last_payment_id')
          .eq('store_id', storeId)
          .maybeSingle();
        if (currentSub?.last_payment_id) {
          processingPaymentsSet.delete(currentSub.last_payment_id);
        }
      } catch { /* ignore secondary fetch failure */ }

      return { status: 'expired', error: err };

    } finally {
      // Always release locks in finally
      if (isMounted.current) {
        setLoading(false);
        setIsSyncing(false);
        recoveryInProgress.current = false;
      }
      isCheckingRef.current = false; // Release synchronous execution lock
      if (activatingHardStopTimer.current) {
        clearTimeout(activatingHardStopTimer.current);
        activatingHardStopTimer.current = null;
      }
    }
  }, [authReady, storeId, storeLoading, recoveryAttempts]);

  // ── PHASE 2 + 3: Primary subscription check ─────────────────────────────────
  // Only runs when auth AND store are ready.
  useEffect(() => {
    // PHASE 1 GATE
    if (authLoading || !authReady) return;

    // PHASE 2 GATE
    if (storeLoading) return;

    if (!storeId) {
      // Store loading is done but storeId is still null
      setLoading(false);
      setIsAllowed(false);
      return;
    }

    syncSubscription();
  }, [authReady, authLoading, storeId, storeLoading, syncSubscription]);

  // ── Session recovery on load ─────────────────────────────────────────────────
  useEffect(() => {
    // GATE: auth + store must be ready. Only run if status is expired.
    if (!authReady || !storeId || status !== 'expired' || isCheckingRef.current) return;

    const recoverOnLoad = async () => {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('last_payment_id')
        .eq('store_id', storeId)
        .maybeSingle();

      if (!sub?.last_payment_id) return;

      let alreadyHandled =
        handledPaymentsSet.has(sub.last_payment_id) ||
        processingPaymentsSet.has(sub.last_payment_id);

      if (!alreadyHandled) {
        try {
          const handled = JSON.parse(localStorage.getItem('handledPayments') || '[]');
          alreadyHandled = handled.includes(sub.last_payment_id);
        } catch { /* ignore */ }
      }

      if (!alreadyHandled) {
        processingPaymentsSet.add(sub.last_payment_id);
        console.log('[SubscriptionGuard] Session recovery detected. Starting...');
        syncSubscription(true);
      }
    };

    recoverOnLoad();
  }, [authReady, storeId, status, syncSubscription]);

  // ── Silent background re-check (5s delay, max 3 attempts) ───────────────────
  useEffect(() => {
    if (
      !authReady ||
      status !== 'expired' ||
      !storeId ||
      isCheckingRef.current ||
      hasCheckedBackground.current ||
      recoveryAttempts >= MAX_RECOVERY_ATTEMPTS
    ) return;

    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      console.log(`[SubscriptionGuard] Background re-check (attempt ${recoveryAttempts + 1}/${MAX_RECOVERY_ATTEMPTS})...`);
      syncSubscription(true);
      if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS - 1) {
        hasCheckedBackground.current = true;
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [authReady, status, storeId, syncSubscription, recoveryAttempts]);

  // ── PHASE 7: Global failsafe — no screen stays loading > 10 seconds ─────────
  useEffect(() => {
    if (!loading) return;

    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      console.warn('[SubscriptionGuard] GLOBAL FAILSAFE: 10s timeout. Forcing exit.');
      setLoading(false);
      setIsSyncing(false);
      recoveryInProgress.current = false;
      isCheckingRef.current = false;
      // If still undecided after 10s, mark as error
      setIsAllowed(prev => {
        if (prev === null) {
          setHasError(true);
          return false;
        }
        return prev;
      });
    }, GLOBAL_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  // ── Sync timeout guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSyncing) return;

    const timer = setTimeout(() => {
      if (!isMounted.current) return;
      console.warn('[SubscriptionGuard] isSyncing timeout. Forcing reset.');
      setIsSyncing(false);
      recoveryInProgress.current = false;
      isCheckingRef.current = false;
    }, GLOBAL_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isSyncing]);

  // ── Cross-tab subscription sync ──────────────────────────────────────────────
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'handledPayments' && authReady && storeId && !isCheckingRef.current) {
        console.log('[SubscriptionGuard] Cross-tab payment detected. Syncing...');
        syncSubscription(true);
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, [authReady, storeId, syncSubscription]);

  return {
    isAllowed,
    daysRemaining,
    hoursInGracePeriod,
    status,
    planName,
    // Expose combined loading: auth + store + subscription
    loading: authLoading || storeLoading || loading,
    // Only show "Activating..." when actually in recovery (not on initial load)
    isSyncing: isSyncing && recoveryInProgress.current && recoveryAttempts < MAX_RECOVERY_ATTEMPTS,
    recoveryAttempts,
    hasError,
    authLoading,
    storeLoading,
    // manual=true so the subscription page polling loop is never blocked by the lock
    checkSubscriptionSync: () => syncSubscription(true, true),
    isTrial: status === 'trial',
    canUseOCR: planName === 'Professional' || planName === 'Enterprise' || planName === 'Lifetime',
    canUseAdvancedInventory: planName === 'Professional' || planName === 'Enterprise' || planName === 'Lifetime',
    canUseAnalytics: planName === 'Professional' || planName === 'Enterprise' || planName === 'Lifetime',
  };
}
