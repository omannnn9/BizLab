# BizLab — SaaS Subscription Model

Schema: `supabase/migrations/0011_billing_subscriptions.sql`. UI:
Settings → Billing (`src/pages/settings/billing-settings-page.tsx`).

## Plans

| Plan | Price (mo / yr) | Members | Storage | Whiteboards | Knowledge Hub | Audit logs | SSO | Guest seats |
|---|---|---|---|---|---|---|---|---|
| **Free** | $0 | 5 | 1 GB | ✗ | ✗ | ✗ | ✗ | 0 |
| **Starter** | $12 / $110 | 20 | 20 GB | ✓ | ✓ | ✗ | ✗ | 5 |
| **Business** | $29 / $278 | 100 | 100 GB | ✓ | ✓ | ✓ | ✗ | 20 |
| **Enterprise** | $49 / $470 | Unlimited | 1 TB | ✓ | ✓ | ✓ | ✓ | Unlimited |

Annual pricing is ~20% off monthly (`price_annual_cents` on
`subscription_plans`). Prices seeded in 0011 are a starting placeholder,
tuned against real usage/CAC once there are paying customers — not
treated as final.

Feature gating reads `subscription_plans.features` (a JSON flag bag:
`whiteboards`, `knowledge_hub`, `audit_logs`, `sso`, `guest_seats`, ...)
rather than hardcoding plan names into feature checks, so adding a new
gated feature is a data change, not a code change, in the common case.

## Billing model

- **Per workspace, not per user.** Each `company` has exactly one
  `company_subscriptions` row (`unique(company_id)`), matching "Oman
  belongs to Tablo, Odax, Nova" — three companies, three independent
  subscriptions, three independent bills. A user with no subscription
  role in a company (e.g. an Employee) never sees its billing page
  (`billing: { view: 'admin' }` in the permission matrix).
- **New companies start on a 14-day Free-tier trial**
  (`seed_company_subscription()` trigger, 0011) — zero-friction signup,
  matching "extremely simple UX" as a first principle. No credit card is
  collected at signup.
- **Seats**: `company_subscriptions.seats` combined with
  `subscription_plans.max_members` is the ceiling; the Members settings
  page shows current usage against the limit (progress bar). Enforcing
  the ceiling at invite-time (blocking a new invite once the plan's
  member limit is hit) is a small ROADMAP item once Stripe metering is
  wired up.
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
   `/w/:slug/settings/billing`.
2. **Webhooks** — a second Edge Function receives
   `customer.subscription.updated/deleted`, `invoice.paid`, etc., and
   writes through to `company_subscriptions`/`invoices` using the
   Supabase **service role** key (never exposed to the browser).
3. **Self-serve upgrade/downgrade** — the "Upgrade" button on each plan
   card in Billing settings already exists in the UI; today it opens a
   toast pointing at this document. Wiring it to step 1 is the concrete
   next task once a Stripe account is provisioned (a real financial
   integration — deliberately not something to fake or auto-provision
   without the business's explicit go-ahead).

No fake/mock payment flow was built in its place — better to be honest
that billing isn't live yet than to ship a checkout button that silently
does nothing meaningful.

## Downgrade & overage handling (policy, to implement alongside Stripe)

- If a workspace exceeds a lower plan's member/storage limit at
  downgrade time, block the downgrade and surface which limit is
  exceeded (mirrors GitHub/Linear-style downgrade guards).
- Storage overage: soft-block new uploads once
  `company_storage_usage.used_bytes >= companies.storage_quota_bytes`;
  never delete data for being over quota.
