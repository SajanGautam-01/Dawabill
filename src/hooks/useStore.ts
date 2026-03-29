import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function useStore() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStore() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true';

        // Fetch the store ID linked to the current user
        const { data, error } = await supabase
          .from('users')
          .select('store_id, role')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.warn("Store Fetch Error:", error.message);
          
          // QA AUDIT / TESTING MODE FALLBACK
          if (isTestingMode) {
            console.log("TESTING_MODE: Attempting to assign default store...");
            const { data: anyStore } = await supabase.from('stores').select('id').limit(1).maybeSingle();
            setStoreId(anyStore?.id || '00000000-0000-0000-0000-000000000000');
            setUserRole('admin');
          }
        } else if (data) {
          setStoreId(data.store_id);
          setUserRole(data.role);
        }
      } catch (err) {
        console.error("Critical Store Hook Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStore();
  }, []);

  return { storeId, userRole, loading };
}
