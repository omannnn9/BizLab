# BizLab — Security Architecture

## 1. Authentication

- **Supabase Auth** (GoTrue) issues short-lived JWTs (access token) plus a
  refresh token, stored via `@supabase/supabase-js`'s `persistSession` /
  `autoRefreshToken` (see `src/lib/supabase.ts`). Passwords are hashed by
  Supabase Auth (bcrypt), never touched by application code.
- **MFA**: Supabase Auth supports TOTP factors natively
  (`auth.mfa_factors`, `supabase.auth.mfa.*`). BizLab does not duplicate
  this — `companies.security_settings.require_mfa` is the policy flag an
  Admin sets (Settings → Security), and enforcing it (blocking sign-in for
  members without an enrolled factor once the flag is on) is the
  concrete next implementation step (ROADMAP). The UI toggle and storage
  already exist.
- **SSO/SAML**: `companies.security_settings.sso_enabled` and the
  Enterprise plan's `features.sso` flag reserve the policy surface; wiring
  an actual SAML/OIDC identity provider is a Supabase Auth "Enterprise
  SSO" feature to enable per-project when the first customer needs it.

## 2. Authorization

Covered in full in `PERMISSIONS.md`. In short: **Postgres RLS is the only
real boundary.** Every table's policies are defined alongside the table in
its migration file, not in a separate "security layer" that could drift
out of sync with the schema.

## 3. Session management

- `companies.security_settings.session_timeout_minutes` is the
  per-workspace inactivity timeout (Settings → Security). Enforcing it
  client-side (auto sign-out after N minutes idle) and/or server-side
  (shortening JWT `exp` per workspace policy) is a ROADMAP item — the
  setting is stored and editable today.
- Supabase Auth already handles refresh-token rotation and revocation
  (`supabase.auth.signOut()` invalidates the session across the
  `auth.sessions` table).

## 4. Encryption

- **In transit**: Supabase enforces TLS on every client connection
  (Postgres, Storage, Auth, Realtime) — there is no unencrypted path.
- **At rest**: Supabase-managed Postgres and Storage are encrypted at
  rest by the underlying cloud provider (AES-256). No application-level
  action is required; this is a platform guarantee to document for
  customers, not something BizLab code implements.
- **Secrets**: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  (a public, RLS-constrained key by design) ship to the browser. Anything
  requiring elevated privilege (service-role key, Stripe secret key)
  belongs in an Edge Function's environment, never in frontend code —
  see ARCHITECTURE.md §5.

## 5. Audit logging & permission auditing

Two distinct logs, on purpose (see `0010_notifications_activity_audit.sql`):

| Table | Purpose | Mutable? | Who can read |
|---|---|---|---|
| `activity_logs` | Product activity feed ("Jane completed Task X") — powers the Dashboard "Recent activity" widget | Insert-only from app code | Any company member |
| `audit_logs` | Security/compliance trail: logins, role changes, permission overrides, exports, deletions | Insert-only, **no update/delete RLS policy at all** — genuinely immutable from the client | Admins and Owners only |

`audit_logs` captures `actor_id`, `action`, `target_type/id`, `ip_address`,
`user_agent` and a JSON `metadata` blob, so "who changed this member's
role, from where, when" is answerable without joining across five tables.
The Security settings page renders the latest 50 events for Admins+
today; writing an entry on every sensitive mutation (role changes,
permission overrides, document sharing changes) is a small, mechanical
ROADMAP item once the write-paths for those actions are finalized in
product.

## 6. File security

- Uploads go straight to a private Supabase Storage bucket
  (`company-files`) — never public. `storage.objects` RLS policies
  (0005) check `is_company_member((storage.foldername(name))[1]::uuid)`,
  i.e. the first path segment of every object *is* the owning
  `company_id`, so a member of Company A can never read an object whose
  path starts with Company B's id, even with a guessed URL.
- Downloads use short-lived **signed URLs**
  (`storage.createSignedUrl(path, 60)` — 60 seconds), not public links.
- `avatars` is the one public bucket (profile pictures only), scoped so
  each user can only write under their own `auth.uid()` folder.

## 7. Tenant isolation guarantees

See PERMISSIONS.md §"Multi-tenant isolation". The practical guarantee:
**every** row a client can read or write is filtered by
`is_company_member(company_id)` (or a function that itself calls it,
like `document_access_level()`), enforced by Postgres itself — not by
application code remembering to add a `WHERE company_id = ?` clause. This
is the single most important security property of the system: even a bug
in the React app cannot leak cross-tenant data, because the database
refuses to return or accept rows outside the caller's membership.

## 8. What's explicitly out of scope today (see ROADMAP.md)

- Enforced MFA / SSO login flows (settings exist; enforcement doesn't yet)
- IP allow-listing (`security_settings.allowed_ip_ranges` is stored, not
  enforced)
- Automated audit-log writes on every sensitive mutation
- SOC 2 / compliance program (organizational, not a code deliverable)
- Rate limiting / abuse protection at the edge (delegate to
  Vercel/Supabase platform controls, revisit if abuse is observed)
