/**
 * DawaBill — Subscription Route Layout
 *
 * SAFE LAYER — NEW FILE ONLY. The existing subscription/page.tsx is NOT modified.
 *
 * Next.js layouts automatically wrap child pages without any modification to
 * the child. This layout adds the payment integration wrapper around the existing
 * subscription page using Next.js's built-in layout composition.
 *
 * When NEXT_PUBLIC_TESTING_MODE === "true":
 *   The SubscriptionPaymentWrapper does nothing — all existing click handlers
 *   inside SubscriptionPage execute normally.
 *
 * When NEXT_PUBLIC_TESTING_MODE === "false" (production):
 *   Clicking a plan button is intercepted by the wrapper, and the real
 *   Razorpay payment flow is triggered.
 */

import SubscriptionPaymentWrapper from "@/components/shared/SubscriptionPaymentWrapper";

export default function SubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubscriptionPaymentWrapper>
      {children}
    </SubscriptionPaymentWrapper>
  );
}
