# DawaBill - Full Architectural & Developer Notes

This document contains the complete technical blueprint of the DawaBill SaaS platform. This acts as a handover guide for any developer or AI (ChatGPT/Claude) to understand the exact frontend and backend implementations.

## 1. Technology Stack
*   **Frontend Framework:** Next.js 14 (App Router)
*   **Styling:** Tailwind CSS + Lucide React Icons
*   **UI Components:** Custom UI library (Radix primitives)
*   **Authentication & Database:** Supabase (PostgreSQL)
*   **State Management:** React Context / Custom Hooks (`useStore`, `useSubscriptionGuard`)
*   **Payments:** Razorpay Node SDK + Razorpay Checkout JS
*   **PWA:** Native Service Worker (`sw.js`) with Offline LocalStorage Queuing.
*   **Specialized Tools:** 
    *   `react-to-print` (For A4/Thermal PDF Invoices)
    *   `recharts` (For Dashboard Analytics)
    *   `tesseract.js` (For Medicine OCR - Dynamically loaded)

---

## 2. Backend Architecture (Supabase)

### A. Database Multi-Tenancy (Row Level Security)
Every table is locked down using Supabase RLS policies. A tenant (Medical Store) can only access rows where `store_id` matches the `store_id` linked to their `auth.uid()` in the public `users` table.
*   **`stores`**: Root tenant table (`id`, `name`, `address`, `gst_no`)
*   **`users`**: Links the auth user to the store (`id`, `store_id`, `role: admin/staff/super_admin`)
*   **`plans` & `subscriptions`**: SaaS tier tracking (`status`, `expiry_date`)
*   **`products`**: Inventory (`stock_quantity`, `sale_rate`, `batch_number`, `expiry_date`)
*   **`bills` & `bill_items`**: Invoicing engine.
*   **`payment_accounts`**: UPI configurations for QR codes.
*   **`support_tickets`**: Ticket system for Super Admin communication.

### B. Core Postgres Functions (RPC & Triggers)
1.  **Auth Trigger (`handle_new_user`)**: 
    Automatically fires ON INSERT to `auth.users`. It atomically creates a new `stores` record, and a new `users` record (with role `admin`), preventing RLS deadlock bug. *(File: `supabase_auth_trigger.sql`)*
2.  **Stock Decrement RPC (`decrement_stock`)**:
    Prevents race conditions if two cashiers bill the same medicine simultaneously. Atomically updates `products` using `GREATEST(stock_quantity - p_amount, 0)`. *(File: `supabase_rpc_decrement_stock.sql`)*
3.  **Nightly Cron Tasks (`pg_cron`)**:
    Executes daily at midnight. Hard-deletes rows sitting in `deleted_items` for > 7 days. Marks `subscriptions` as 'expired' if `expiry_date < NOW()`.

---

## 3. API Routes (Next.js backend)

### Razorpay Payment Flow
*   **`POST /api/razorpay/order`**: Checks the selected SaaS plan, computes amount in paise, creates a server-side order using `razorpay.orders.create()`.
*   **`POST /api/razorpay/verify`**: Receives `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` from the frontend. Uses `crypto.createHmac` to verify authenticity. Updates Supabase subscription `expiry_date` synchronously.
*   **`POST /api/razorpay/webhook`**: Listens for background events (like `payment.captured` or `payment.failed`). Serves as an asynchronous failsafe if the user closes the browser during verification.

---

## 4. Frontend Architecture (React / App Router)

### A. Core Hooks & Providers
*   **`useStore.ts`**: The main context that fetches the current user's profile and provides `storeId` globally to all components.
*   **`useSubscriptionGuard.ts`**: Security hook. Runs on `billing` and `inventory`. Compares database `expiry_date` accurately against the current system time. If expired, it locks the UI and forces the user to the renewal page.

### B. Module Breakdown
1.  **Billing & POS (`/billing`)**:
    *   Keyboard and barcode scanner friendly inputs.
    *   **Offline Fallback:** If `navigator.onLine` is false during checkout, the invoice is saved to `localStorage` (`dawabill_offline_queue`).
    *   **Sync Engine:** `syncOfflineBills()` iterates safely through the offline queue, inserts into DB, calls the Stock RPC, and removes each bill from local storage immediately on success to prevent duplicates.
    *   **PDF System:** Passes the generated JSON bill to the hidden `<InvoiceTemplate />` and triggers the native browser print dialogue. Adds dynamic API generated UPI QR code.

2.  **Inventory & OCR (`/inventory` & `/ocr`)**:
    *   Standard CRUD with visual "Low Stock" indicators.
    *   **Performance OCR:** The `tesseract.js` OCR WebAssembly is over 20MB. It is *dynamically imported* `await import('tesseract.js')` only exactly when the user clicks "Run OCR Extraction" to save initial PWA bundle size.

3.  **Smart Features (`/reports`)**:
    *   Operates purely on DB mathematics (No paid external APIs).
    *   **Expiry Financial Loss:** Aggregates `stock_quantity * purchase_rate` for all expired inventory.
    *   **Predictive Stock:** Uses `bill_items` from the last 30 days to calculate a daily run-rate. Divides current stock by run-rate to predict "Days Left" until blackout.
    *   **VIP Customers:** Aggregates `bills` table by `customer_phone` to build a Lifetime Value (LTV) leaderboard.

4.  **Super Admin (`/super-admin`)**:
    *   Protected route. Immediately boots any user whose role is not `super_admin`.
    *   Features large scale pagination: `supabase.from('stores').range(0, 50)` prevents browser freeze.
    *   Features manual subscription overriding (+30 Days button) and Store disablement (emergency kill-switch).

### C. Progressive Web App (PWA)
*   **Manifest & Install:** Global `<InstallPrompt />` listens for `beforeinstallprompt` and renders a clean "Add to Home Screen" SaaS popup.
*   **Service Worker (`sw.js`)**: Setup App Shell caching on install. Uses a robust `Network First, Fallback to Cache` strategy for core routes (`/dashboard`, `/billing`). API mutations (`/api/`) are explicitly excluded from cache to prevent ghost data.

---

## 5. Deployment Checklist & Environment Variables

To launch on Vercel, the following `.env.local` keys must be populated:
```env
# Database Core
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_KEY]  # Vital for webhooks bypassing RLS

# Payments
NEXT_PUBLIC_RAZORPAY_KEY_ID=[test/live_key]
RAZORPAY_KEY_SECRET=[test/live_secret]
RAZORPAY_WEBHOOK_SECRET=[custom_configured_secret_on_razorpay_dashboard]
```
