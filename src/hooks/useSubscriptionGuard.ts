import { useState, useEffect } from 'react';
import { useStore } from './useStore';

export function useSubscriptionGuard() {
  const { storeId, loading: storeLoading } = useStore();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number| null>(null);
  const [status, setStatus] = useState<'trial' | 'active' | 'expired'>('expired');
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true';

  useEffect(() => {
    if (isTestingMode) {
      // QA AUDIT BYPASS: Always allow access during audit phase
      setIsAllowed(true);
      setStatus('active');
      setLoading(false);
      setPlanId('professional'); // Allow OCR/Advanced features for testing
      setDaysRemaining(365);
    }
  }, [storeId, storeLoading, isTestingMode]);

  return { 
    isAllowed, 
    daysRemaining, 
    status, 
    planId,
    loading,
    isTrial: status === 'trial',
    canUseOCR: true,
    canUseAdvancedInventory: true
  };
}
