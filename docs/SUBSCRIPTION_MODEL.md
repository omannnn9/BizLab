# BizLab — SaaS Subscription Model

Schema: `supabase/migrations/0011_billing_subscriptions.sql`,
`0019_pricing_tiers.sql`. UI: Settings → Billing
(`src/pages/settings/billing-settings-page.tsx`). Feature gating:
`src/hooks/use-billing.ts` (`useFeatureEnabled`).

## Plans

| Plan | Price (mo / yr) | Members | Storage | Guest seats | Whiteboards | Knowledge Hub | CRM | HR | Finance | Audit logs | SSO |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Starter** | $15 / $144 | 10 | 10 GB | 0 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Growth** | $39 / $374 | 50 | 50 GB | 10 | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Business** | $89 / $854 | 250 | 250 GB | 50 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Enterprise** | $249 / $2,390 (custom pricing available) | Unlimited | 2 TB | Unlimited | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Annual pricing is ~20% off monthly (`price_annual_cents` on
`subscription_plans`). These are launch-pricing hypotheses, not
market-tested numbers — expect to move them once there's real
usage/CAC/win-rate data; that's exactly why they live in a data table
instead of being hardcoded into the app.

Feature gating reads `subscription_plans.features` (a JSON flag bag:
`whiteboards`, `knowledge_hub`, `crm`, `hr`, `finance`, `audit_logs`,
`sso`, `guest_seats`, ...) rather than hardcoding plan names into
feature checks, so adding a new gated feature or moving one between
tiers is a data change, not a code change.

### ⚠ Enforcement gap — read before calling this "done"

`useFeatureEnabled()` and the sidebar's locked/greyed-out nav items
(`src/components/layout/sidebar.tsx`) are **client-side only**. They
produce the right upsell UX (a Starter workspace sees "CRM 🔒" and
clicking it goes to Billing, not a broken page) but **nothing in
Postgres RLS currently checks the workspace's plan** before allowing a
read or write to `crm_*`, `hr_*`, or `finance_*` tables — only company
membership and role, per `docs/PERMISSIONS.md`. A technically capable
user on a Starter plan could still call the Supabase REST API directly
and create CRM rows. Closing this requires either:

- an `is_feature_enabled(company_id, feature_key)` SQL function (mirror
  of `useFeatureEnabled`, reading `company_subscriptions` → `plan` →
  `features`) added to the `WITH CHECK` of every gated table's INSERT
  policy, or
- accepting the gap for launch and treating plan tiers as a UX/pricing
  lever rather than a hard entitlement wall (common for early-stage
  SaaS; Notion and Linear both under-enforce plan gates in exactly this
  way for a long time).

This is a real, open item — see `docs/ROADMAP.md` — not something to
claim as finished.

## Billing model

- **Per workspace, not per user.** Each `company` has exactly one
  `company_subscriptions` row (`unique(company_id)`), matching "Oman
  belongs to Tablo, Odax, Nova" — three companies, three independent
  subscriptions, three independent bills. A user with no subscription
  role in a company (e.g. an Employee) never sees its billing page
  (`billing: { view: 'admin' }` in the permission matrix).
- **New companies start on a 14-day trial on the Starter plan**
  (`seed_company_subscription()` trigger, 0011/0019) — zero-friction
  signup, matching "extremely simple UX" as a first principle. No
  credit card is collected at signup. Trial-to-paid conversion (what
  happens when `trial_ends_at` passes with no payment method on file)
  is a Stripe-webhook concern — see below.
- **Seats**: `company_subscriptions.seats` combined with
  `subscription_plans.max_members` is the ceiling; the Members settings
  page shows current usage against the limit (progress bar). Enforcing
  the ceiling at invite-time (blocking a new invite once the plan's
  member limit is hit) is a small ROADMAP item once Stripe metering is
  wired up — today it's informational only, same enforcement gap as
  feature gating above.
- **Guest seats** are budgeted separately per plan
  (`features.guest_seats`) since guests are typically free or
  cheaper than full seats in this category of product (Notion, ClickUp,
  Slack all do this) — the flag exists for that pricing lever even
  though it isn't enforced yet.

## Stripe integration (roadmap — schema is ready, integration is not)

`company_subscriptions` already carries `stripe_customer_id` and
`stripe_subscription_id`; `invoices` mirrors Stripe's invoice objects
(`stripe_invoice_id`, `invoice_pdf_url`, `status`). The intended flow:

1. **Checkout** — an Edge Function creates a Stripe Checkout Session for
   the selected plan/interval, redirects back to
   `/w/:slug/settings/billing`. Stripe Checkout natively supports a
   promotion-code field, so **coupons** need no BizLab-side redemption
   logic — create the coupon/promotion code in the Stripe Dashboard (or
   via API) and it applies at checkout; the webhook below just records
   whatever Stripe settles on.
2. **Webhooks** — a second Edge Function receives
   `customer.subscription.created/updated/deleted`,
   `invoice.paid`/`invoice.payment_failed`, and
   `checkout.session.completed`, and writes through to
   `company_subscriptions`/`invoices` using the Supabase **service
   role** key (never exposed to the browser). This is also where
   **trial-expiry** and **past_due** transitions land —
   `company_subscriptions.status` moves `trialing → active` on first
   successful payment, or `trialing → past_due`/`canceled` if none
   arrives before `trial_ends_at`.
3. **Monthly ↔ Annual** — a plan-and-interval change from Stripe's
   customer portal (or a BizLab-hosted equivalent) fires
   `customer.subscription.updated`; the webhook updates
   `billing_interval` and `current_period_end` to match. No separate
   BizLab logic needed beyond passing the interval through the
   original Checkout Session.
4. **Upgrades/downgrades** — same webhook path. The only BizLab-side
   guard needed before *allowing* a downgrade: block it and surface
   which limit is exceeded if the workspace is currently over the
   target plan's member count or storage quota (mirrors GitHub/Linear
   downgrade guards) — not yet implemented, tracked in ROADMAP.
5. **Self-serve upgrade/downgrade UI** — the plan cards in Billing
   settings (with a monthly/annual toggle, live from
   `price_monthly_cents`/`price_annual_cents`) already exist; the
   "Upgrade" button currently opens a toast pointing at this document
   rather than a real Checkout redirect. Wiring step 1 in is the
   concrete next task once a Stripe account is provisioned — a real
   financial integration, deliberately not something to fake or
   auto-provision without the business's explicit go-ahead.

No fake/mock payment flow was built in its place — better to be honest
that billing isn't live yet than to ship a checkout button that silently
does nothing meaningful.

## Downgrade & overage handling (policy, to implement alongside Stripe)

- If a workspace exceeds a lower plan's member/storage limit at
  downgrade time, block the downgrade and surface which limit is
  exceeded.
- Storage overage: already enforced today, independent of Stripe —
  `check_storage_quota()` (0014) hard-blocks a file upload once
  `company_storage_usage.used_bytes + incoming > companies.storage_quota_bytes`,
  regardless of plan-sync status. Never delete data for being over quota.
