"use client";

/**
 * DawaBill — SubscriptionPaymentWrapper
 *
 * SAFE LAYER: Wraps the existing subscription page's plan cards.
 * The existing subscription/page.tsx is NOT modified.
 *
 * HOW IT WORKS (Two-Component Pattern):
 *  - TESTING MODE ON  → renders <>{children}</> — a pure transparent fragment.
 *    ZERO hooks called. ZERO interception. ZERO extra UI.
 *    The existing handleActivatePlan runs 100% unchanged.
 *  - TESTING MODE OFF → mounts ProductionPaymentLayer which holds ALL hooks
 *    and intercepts plan button clicks for the real Razorpay flow.
 *
 * WHY TWO COMPONENTS?
 *  React hooks cannot be called conditionally. To guarantee NO hook runs in
 *  testing mode, all hooks live inside ProductionPaymentLayer — which is
 *  never mounted when NEXT_PUBLIC_TESTING_MODE=true.
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getPlanPrice } from "@/lib/planConfig";
import { usePaymentTrigger } from "@/hooks/usePaymentTrigger";
import { useToast } from "@/components/ui/Toast";
import PaymentModal from "@/components/shared/PaymentModal";
import type { BillingCycle } from "@/lib/planConfig";

interface SubscriptionPaymentWrapperProps {
  children: React.ReactNode;
}

// ─── DOM Utilities ────────────────────────────────────────────────────────────

/** Walks up the DOM to find the plan name from the Card's <h3> title. */
function extractPlanFromClick(target: Element): { name: string; id: string } | null {
  let node: Element | null = target;
  const maxDepth = 12;
  let depth = 0;

  while (node && depth < maxDepth) {
    if (node.classList.contains("rounded-3xl")) {
      const planId = node.getAttribute("data-plan-id") || "";
      const titleEl = node.querySelector("h3");
      if (titleEl) {
        const text = titleEl.textContent?.trim() || "";
        const known = ["Starter", "Professional", "Enterprise"];
        const found = known.find((p) =>
          text.toLowerCase().includes(p.toLowerCase())
        );
        if (found) return { name: found, id: planId };
      }
      break;
    }
    node = node.parentElement;
    depth++;
  }
  return null;
}

/** Reads whether Yearly toggle is active from DOM state. */
function detectBillingCycle(): BillingCycle {
  if (typeof document === "undefined") return "monthly";
  const buttons = document.querySelectorAll("button");
  for (const btn of Array.from(buttons)) {
    if (
      btn.classList.contains("bg-slate-900") &&
      btn.textContent?.trim().toLowerCase().includes("yearly")
    ) {
      return "yearly";
    }
  }
  return "monthly";
}

/** True only for plan Subscribe/Start/Upgrade/Trial buttons inside cards. */
function isSubscribeButton(target: Element): boolean {
  const btn = target.closest("button");
  if (!btn) return false;
  const text = btn.textContent?.toLowerCase() || "";
  const include = ["subscribe", "start", "upgrade", "trial"];
  const exclude = ["sign out", "settings", "talk to", "monthly", "yearly"];
  return (
    include.some((kw) => text.includes(kw)) &&
    !exclude.some((kw) => text.includes(kw))
  );
}

// ─── Production Payment Layer ─────────────────────────────────────────────────
// Only mounted when TESTING_MODE is false.
// All hooks live here — never called in testing mode.

function ProductionPaymentLayer({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [activePlanPrice, setActivePlanPrice] = useState<number | undefined>(undefined);

  // Synchronous ref lock — prevents race conditions before state updates land
  const processingRef = useRef(false);

  const { triggerPayment, isProcessing } = usePaymentTrigger(toast);

  const handleWrapperClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as Element;
      if (!isSubscribeButton(target)) return;

      const planInfo = extractPlanFromClick(target);
      if (!planInfo) return;

      if (processingRef.current || isProcessing) return;

      e.preventDefault();
      e.stopPropagation();

      const { name: planName, id: planId } = planInfo;

      const billingCycle = detectBillingCycle();
      const price = getPlanPrice(planName, billingCycle);

      processingRef.current = true;
      setActivePlanName(planName);
      setActivePlanPrice(price);
      setPaymentModalOpen(true);

      let userId = "";
      let userEmail = "";
      let storeId = "";

      try {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id || "";
        userEmail = session?.user?.email || "";

        if (userId) {
          const { data: userData } = await supabase
            .from("users")
            .select("store_id")
            .eq("id", userId)
            .maybeSingle();
          storeId = userData?.store_id || "";
        }
      } catch (sessionErr) {
        console.error("[PaymentWrapper] Session fetch error:", sessionErr);
        processingRef.current = false;
        setPaymentModalOpen(false);
        toast("Unable to verify your session. Please refresh and try again.", "error");
        return;
      }

      if (!storeId || !userId) {
        processingRef.current = false;
        setPaymentModalOpen(false);
        toast("Store or user information missing. Please log in again.", "error");
        return;
      }

      await triggerPayment({ planName, planId, billingCycle, storeId, userId, userEmail });

      processingRef.current = false;
      setPaymentModalOpen(false);
    },
    [isProcessing, triggerPayment, toast]
  );

  return (
    <div onClick={handleWrapperClick} style={{ display: "contents" }}>
      <PaymentModal isOpen={paymentModalOpen} planName={activePlanName} price={activePlanPrice} />
      {children}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SubscriptionPaymentWrapper({ children }: SubscriptionPaymentWrapperProps) {
  const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === "true";

  // ── TESTING MODE: Zero-overhead transparent passthrough ──────────────────
  // No hooks. No interception. No extra UI. handleActivatePlan runs unchanged.
  if (isTestingMode) {
    return <>{children}</>;
  }

  // ── PRODUCTION MODE: Real Razorpay payment layer ─────────────────────────
  return <ProductionPaymentLayer>{children}</ProductionPaymentLayer>;
}
