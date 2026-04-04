/**
 * DawaBill — Central Plan Configuration
 *
 * SAFE LAYER: This file is isolated from all existing business logic.
 * Only imported by new payment integration files.
 * Future-ready: supports monthly + yearly, and can be swapped for DB-driven config.
 */

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanConfig {
  /** Unique slug used as a stable ID in API calls */
  id: string;
  /** Display name — must match the `plans.name` column in Supabase */
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  /** Days added to expiry on subscription activation */
  monthlyDays: number;
  yearlyDays: number;
}

/**
 * Canonical plan list.
 * Prices are intentionally NOT trusted on the frontend for payments —
 * the backend (`sub-verify`) fetches the authoritative price from DB.
 * This config is used only to build the Razorpay order amount and display labels.
 */
export const PLAN_CONFIG: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    yearlyPrice: 950,
    monthlyDays: 30,
    yearlyDays: 365,
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 149,
    yearlyPrice: 1430,
    monthlyDays: 30,
    yearlyDays: 365,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    yearlyPrice: 1910,
    monthlyDays: 30,
    yearlyDays: 365,
  },
];

/**
 * Returns the correct amount (in ₹) for a plan + billing cycle.
 * Used when creating the Razorpay order so the amount is consistent.
 */
export function getPlanPrice(planName: string, cycle: BillingCycle): number {
  const plan = PLAN_CONFIG.find(
    (p) => p.name.toLowerCase() === planName.toLowerCase()
  );
  if (!plan) return 0;
  return cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
}

/**
 * Returns number of days to add on activation.
 */
export function getPlanDays(planName: string, cycle: BillingCycle): number {
  const plan = PLAN_CONFIG.find(
    (p) => p.name.toLowerCase() === planName.toLowerCase()
  );
  if (!plan) return 30;
  return cycle === 'monthly' ? plan.monthlyDays : plan.yearlyDays;
}
