/**
 * DawaBill — usePaymentTrigger Hook
 *
 * SAFE LAYER: New hook file, does not modify or import from existing hooks.
 * Used exclusively by SubscriptionPaymentWrapper — never injected into existing components.
 *
 * Responsibilities:
 *  - Load Razorpay JS SDK dynamically (browser-safe, lazy)
 *  - Create an order via existing /api/razorpay/order
 *  - Open Razorpay payment modal
 *  - On success → verify via /api/razorpay/sub-verify
 *  - Debounce protection: isProcessing lock prevents duplicate triggers
 *  - Graceful failure handling at every step
 *  - Medical-Grade Jargon: "Checkout", "Verification", "Pharmacy Plan"
 */

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BillingCycle, getPlanPrice } from '@/lib/planConfig';

export interface PaymentTriggerParams {
  planName: string;
  planId: string;
  billingCycle: BillingCycle;
  storeId: string;
  userId: string;
  userEmail?: string;
  userPhone?: string;
}

export interface PaymentTriggerResult {
  triggerPayment: (params: PaymentTriggerParams) => Promise<void>;
  isProcessing: boolean;
  processingPlan: string | null;
}

interface ToastSetter {
  (message: string, type?: 'success' | 'error' | 'info' | 'loading'): void;
}

/**
 * Dynamically loads the Razorpay JS SDK script.
 * Safe to call multiple times — skips if already loaded.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    // Already loaded
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    // Already appended (script tag present but not yet loaded)
    if (document.querySelector('script[src*="razorpay"]')) {
      const existing = document.querySelector(
        'script[src*="razorpay"]'
      ) as HTMLScriptElement;
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * The hook. Accepts a setToast setter from the host component so it can
 * surface success/error messages without managing its own Toast state.
 */
export function usePaymentTrigger(setToast: ToastSetter): PaymentTriggerResult {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // Ref-based lock to prevent race conditions even before state updates
  const processingRef = useRef(false);

  const triggerPayment = useCallback(
    async ({
      planName,
      planId,
      billingCycle,
      storeId,
      userId,
      userEmail,
      userPhone,
    }: PaymentTriggerParams) => {
      // ── Debounce Guard ────────────────────────────────────────────────────
      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);
      setProcessingPlan(planName);

      try {
        // ── Step 1: Load Razorpay SDK ─────────────────────────────────────
        const sdkLoaded = await loadRazorpayScript();
        if (!sdkLoaded) {
          setToast('Payment system unavailable. Please try again later.', 'error');
          return;
        }

        // ── Step 2: Compute Amount ────────────────────────────────────────
        const planAmount = getPlanPrice(planName, billingCycle);
        if (planAmount <= 0) {
          setToast(`Invalid plan selected: ${planName}`, 'error');
          return;
        }

        // ── Runtime Test Override (NON-DESTRUCTIVE) ───────────────────────
        const testAmountOverride = process.env.NEXT_PUBLIC_PAYMENT_TEST_AMOUNT;
        const amount = testAmountOverride && Number(testAmountOverride) > 0
          ? Number(testAmountOverride)
          : planAmount;

        // ── Step 3: Create Order via Existing API ─────────────────────────
        const orderRes = await fetch('/api/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, storeId }),
        });

        if (!orderRes.ok) {
          throw new Error(`Checkout initialization failed (HTTP ${orderRes.status})`);
        }

        const { order, isMock } = await orderRes.json();

        if (!order?.id) {
          throw new Error('Verification handshake failed (Invalid order).');
        }

        // ── Step 4: Open Razorpay Modal ───────────────────────────────────
        const razorpayKey = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '').trim();

        await new Promise<void>((resolve, reject) => {
          const options = {
            key: razorpayKey,
            amount: order.amount,
            currency: order.currency || 'INR',
            name: 'DawaBill Pharmacy SaaS',
            description: `${planName} Subscription (${
              billingCycle === 'yearly' ? 'Annual' : 'Monthly'
            })`,
            order_id: order.id,
            prefill: {
              email: userEmail || '',
              contact: userPhone || '',
            },
            notes: {
              store_id: storeId,
              plan_id: planId,
              plan_name: planName,
              billing_cycle: billingCycle,
            },
            theme: { color: '#0F766E' }, // Medical Teal-700

            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              try {
                // ── Step 5: Verify Payment on Backend ─────────────────────
                const verifyRes = await fetch('/api/razorpay/sub-verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    plan_id: planId,
                    billing_cycle: billingCycle,
                    user_id: userId,
                  }),
                });

                const verifyData = await verifyRes.json();

                if (verifyRes.ok && verifyData.success) {
                  setToast(`Plan Activated: Your ${planName} subscription is now live!`, 'success');
                  router.refresh();
                  window.location.href = '/dashboard';
                  resolve();
                } else {
                  const errorMsg = verifyRes.status === 402 
                    ? `Payment Verification Failed: ${verifyData.reason || 'Audit mismatch'}`
                    : (verifyData.message || verifyData.error || 'Activation protocol failed.');

                  setToast(errorMsg, 'error');
                  reject(new Error(errorMsg));
                }
              } catch (verifyErr: any) {
                setToast('Payment completed but verification is pending. Contact support.', 'error');
                reject(verifyErr);
              }
            },

            modal: {
              ondismiss: () => {
                setToast('Secure checkout closed. No charges were made.', 'info');
                resolve(); 
              },
            },
          };

          if (isMock || !razorpayKey) {
            setToast('Secure gateway not configured. Contact admin for setup.', 'info');
            resolve();
            return;
          }

          try {
            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', (failureResponse: any) => {
              setToast(`Payment Failed: ${
                  failureResponse?.error?.description || 'Please try again'
                }`, 'error');
              reject(new Error('Payment failed'));
            });
            rzp.open();
          } catch (modalErr: any) {
            reject(modalErr);
          }
        });
      } catch (err: any) {
        const knownErrors = [
          'Payment failed',
          'Payment cancelled',
        ];
        if (!knownErrors.some((e) => err?.message?.includes(e))) {
          setToast(err?.message || 'Secure checkout failed. Please retry.', 'error');
        }
      } finally {
        processingRef.current = false;
        setIsProcessing(false);
        setProcessingPlan(null);
      }
    },
    [setToast, router]
  );

  return { triggerPayment, isProcessing, processingPlan };
}
