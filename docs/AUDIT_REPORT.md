# BizLab — Full Audit Report

**Method.** Every finding below was confirmed by one of: (a) reading the
actual RLS policy/trigger/function SQL line by line, tracing the exact
role/column values that would satisfy it; (b) applying all migrations
to a real local Postgres 16 instance (stubbed `auth`/`storage` schemas
to match Supabase's shape — see `supabase/tests/README.md`) and running
them; or (c) exercising the policies as simulated attacker/victim users
via `SET ROLE authenticated; SET request.jwt.claim.sub = ...` and
checking the actual query result, not just reading the SQL and assuming
it does what it says. Findings marked **(execution-only)** were only
catchable by actually running the code — reading the SQL alone would
have missed them, which is itself a finding about how this class of bug
hides.

Every fix listed as "Actual Fix" is committed in this branch and, where
it's a database change, re-verified against Postgres after the fix
(not just written and assumed correct).

---

## Summary table

| ID | Area | Severity | Status |
|---|---|---|---|
| CRIT-01 | Database / Onboarding | Critical | Fixed |
| SEC-01..11 | Database / Multi-tenancy | Critical | Fixed |
| SEC-12 | Chat | Critical | Fixed |
| SEC-13 | Chat | Medium | Fixed |
| SEC-14 | RBAC | Medium | Fixed |
| SEC-15 | Documents/Files | Medium | Fixed |
| SEC-16 | Whiteboards | Low | Fixed |
| SEC-17 | Dashboards | Low | Fixed |
| SEC-18 | Notifications | Medium | Fixed |
| SEC-19 | Activity feed | Medium | Fixed |
| SEC-20 | Audit logging | Critical | Fixed |
| SEC-21 | Search | Low | Fixed (defense-in-depth) |
| SEC-22 | Data integrity | Medium | Fixed |
| SEC-23 | File storage | Medium | Fixed |
| SEC-24 | Notifications | Medium | Fixed |
| REC-01 | RLS self-reference / recursion | High (build-breaking) | Fixed |
| FUNC-01 | Notifications / Activity feed | High (functional) | Fixed |
| FUNC-02 | Members / Invitations | High (functional) | Fixed |
| FUNC-03 | File Storage | Medium (functional) | Fixed |
| PERF-01 | Search | Medium | Fixed |
| PERF-02 | Bundle size | Medium | Fixed |
| AUTH-01 | Authentication | High | Fixed |
| AUTH-02 | Authentication | Medium | Fixed |
| GAP-01 | Commercialization | Medium | Open (documented) |
| GAP-02 | File Storage | Low | Open (documented) |

---

## 1. Database & Multi-Tenancy

### CRIT-01 — `seed_company_defaults()` would fail on every single company creation **(execution-only)**
- **Severity:** Critical
- **Risk:** The trigger that bootstraps every new workspace (owner
  membership, 6 default channels, 5 folders, default dashboard) used
  `CASE WHEN v_channel_name = 'Announcements' THEN 'private' ELSE
  'public' END` with no explicit enum cast, assigned into a
  `channel_type`-typed column.
- **Impact:** Postgres resolves ambiguous string literals inside a
  `CASE` expression to `text` before it ever sees the target column's
  enum type (unlike a bare literal in a `VALUES(...)` list, which
  *does* get the target type). `text` has no implicit cast to a
  user-defined enum. Result: `ERROR: column "type" is of type
  channel_type but expression is of type text` on the very first
  `INSERT INTO companies` — i.e., **the "Create your company
  workspace" step would fail for every single signup.** This bug was
  invisible to static review because it only fires when the trigger
  actually executes, and nothing exercised it until this audit's
  Postgres-backed test suite ran it for the first time.
- **Recommended fix:** Cast the `CASE` expression explicitly.
- **Actual fix:** `(case ... end)::public.channel_type` in
  `supabase/migrations/0006_chat.sql`. Re-verified: company creation
  now succeeds and seeds all defaults correctly (`supabase/tests/security_rls_test.sql`,
  fixture setup).

### SEC-01..SEC-11 — Tenant/parent keys were mutable, enabling cross-tenant data moves
- **Severity:** Critical
- **Risk:** `UPDATE` policies across `tasks`, `projects`, `documents`,
  `folders`, `files`, `chat_channels`, `chat_messages`, `whiteboards`,
  `dashboards`, `knowledge_articles`, `notifications`, `company_subscriptions`,
  `task_comments`, `task_attachments`, `document_comments`, and
  `milestones` were written as `USING (<ownership or role check>)` with
  no explicit `WITH CHECK`. Postgres reuses the `USING` expression as
  the `WITH CHECK` when none is given — which sounds protective, but
  isn't when the ownership clause doesn't reference the column being
  changed.
- **Impact — concretely confirmed, not theoretical:** `files`' policy
  was `uploaded_by = auth.uid() OR has_min_role(company_id, 'manager')`.
  For the uploader branch, the reused `WITH CHECK` re-evaluates to
  `NEW.uploaded_by = auth.uid()` — true regardless of what `NEW.company_id`
  becomes. **Any file's uploader could move that file's row to a
  different company they also belong to**, exposing its name, size,
  and description to that company's members (the file bytes stay
  protected by Storage's own independent path-based RLS, but the
  metadata leaks). The same class of gap existed on every table in the
  list above; for the child tables (`task_comments`, `document_comments`,
  `chat_messages`), the ownership check (`author_id = auth.uid()`)
  didn't reference the parent id at all, so an author could re-parent
  their own comment/message onto **any task/document/channel in the
  entire database**, not just another one in a company they belong to.
- **Recommended fix:** Make tenant/parent-key columns immutable via
  trigger — RLS expressions can't compare OLD vs. NEW directly, so
  trying to encode "must stay the same" inside `WITH CHECK` doesn't
  work; a `BEFORE UPDATE` trigger that rejects the column change
  outright is the standard, unambiguous fix.
- **Actual fix:** `forbid_column_update()`, a generic trigger function
  taking column names via `TG_ARGV`, applied to `company_id` on every
  table above and to the specific parent-id columns on the four child
  tables (`supabase/migrations/0013_security_hardening.sql`). Re-verified:
  `UPDATE files SET company_id = ... ` now fails with `Changing column
  "company_id" on files is not permitted` for the original uploader
  (Test 1, `security_rls_test.sql`).

### SEC-12 — Private chat channels were joinable by any company member **(execution-only for the fix; logic gap was visible on read)**
- **Severity:** Critical
- **Risk:** `chat_channel_members`' INSERT policy checked only
  `is_company_member(company_id)` — never `chat_channels.type`.
- **Impact:** Any company member (not a company outsider — but anyone
  from a large org who isn't supposed to be in, say, a leadership-only
  private channel) could self-insert into **any** channel, public or
  private, including the auto-seeded "Announcements" channel, the
  moment they had the channel's UUID from any legitimate source (a
  shared link, a search result, a notification). "Private" was
  cosmetic — it hid the channel from listings but did not gate
  membership.
- **Recommended fix:** Restrict self-join inserts to `type = 'public'`;
  require a channel owner or company manager+ to add anyone to a
  private/group channel.
- **Actual fix:** Split into two policies — `self-join public channels`
  (public only) and `owners and managers add members to any channel`
  (via a new `is_channel_owner()` SECURITY DEFINER helper). Re-verified:
  Carol, a real Acme employee never added to Announcements, is blocked
  from self-joining it (Test 3); she succeeds joining the public
  General channel (Test 4).

### REC-01 — The SEC-12 fix itself caused "infinite recursion detected in policy" **(execution-only)**
- **Severity:** High (would have shipped a broken migration)
- **Risk:** The first draft of the `owners and managers add members to
  any channel` policy queried `chat_channel_members` via a plain
  subquery *from within a policy on that same table*.
- **Impact:** Postgres cannot resolve "is this new row insertable"
  against "what does the SELECT policy allow" when both point at the
  identical relation inside the same policy-evaluation graph, and
  reports it as infinite recursion rather than resolving it — this
  only surfaces when the INSERT actually runs, not when the SQL is
  reviewed.
- **Recommended fix:** Route the self-referential check through a
  `SECURITY DEFINER` function (which queries the table as its owner,
  bypassing RLS for that one lookup and breaking the cycle) — the same
  pattern already used everywhere else in this schema
  (`is_company_member`, `is_channel_member`, `member_id_in`).
- **Actual fix:** New `is_channel_owner(p_channel_id)` SECURITY DEFINER
  function; both the chat_channel_members INSERT policy and the
  chat_channels UPDATE policy (SEC-13) now use it instead of a raw
  subquery. Re-verified: full migration chain applies with zero errors,
  Tests 2–4 pass.

### SEC-13 — Any channel member could rename, archive, or flip a private channel to public
- **Severity:** Medium
- **Risk:** `chat_channels`' UPDATE policy was `is_channel_member(id) OR
  has_min_role(company_id, 'manager')` — `is_channel_member` doesn't
  check `channel_role`, so a plain member (not the channel's owner)
  could modify the channel.
- **Impact:** A member added to a private channel for one purpose could
  rename it, archive it, or (compounding SEC-12) flip it to `public`,
  exposing its message history to the whole company.
- **Recommended fix:** Restrict updates to the channel's own
  owner(s) or a company manager+.
- **Actual fix:** `channel owners and managers update channels` policy
  using `is_channel_owner()`. Verified via full RLS suite pass.

### SEC-14 — `permission_overrides` rows could reference a member in a different company than the row claimed
- **Severity:** Medium
- **Risk:** The table stores both `company_id` and `member_id`
  (which itself implies a company via `company_members.company_id`),
  with no check that they agree. The INSERT/ALL policy only validated
  the *caller's* admin rights in `company_id` — never that the target
  `member_id` actually belongs to that company.
- **Impact:** An Admin of Company A could insert an override row
  pointing at a member of Company B. Not exploitable for cross-tenant
  *access* today (nothing reads `permission_overrides` yet — see
  PERMISSIONS.md), but it's a live data-integrity hole that would
  become a real privilege-escalation vector the moment any code starts
  consuming this table, and it should never have been possible to
  create an inconsistent row in the first place.
- **Recommended fix:** A trigger validating `NEW.company_id` against
  the member's actual company on every insert/update.
- **Actual fix:** `check_permission_override_company()` trigger,
  `0013_security_hardening.sql`.

### SEC-15 — Folders were fully manageable (including delete) by Guests
- **Severity:** Medium
- **Risk:** A single blanket `ALL` policy on `folders` required only
  `is_company_member(company_id)` — no role floor at all, contradicting
  "Guest = restricted, no default create rights" (`docs/PERMISSIONS.md`)
  and the Employee/Manager split every other module uses for
  create vs. destroy.
- **Impact:** Any Guest, or any Employee with zero stake in a given
  team's folder, could delete the seeded HR/Sales/Finance/Marketing/
  Operations folders outright (contained documents/files survive via
  `ON DELETE SET NULL`, but land back at the root, disrupting
  everyone's navigation).
- **Recommended fix:** Split into role-appropriate policies matching
  the rest of the schema: Employee+ create/rename, Manager+ delete.
- **Actual fix:** Three targeted policies replacing the blanket one,
  `0013_security_hardening.sql`.

### SEC-16 — Whiteboards were editable by Guests
- **Severity:** Low
- **Risk:** `members update whiteboards` required only company
  membership, letting Guests edit any whiteboard despite the stated
  "Guest = restricted" model.
- **Actual fix:** Restricted to Employee+ (`employees+ update
  whiteboards`, `0013_security_hardening.sql`). Note: the
  `whiteboard_collaborators` table (meant for finer per-board sharing)
  remains unused by both RLS and application code — see GAP-02.

### SEC-17 — A Manager could silently edit widgets on another member's *personal* dashboard
- **Severity:** Low
- **Risk:** `dashboard_widgets`' manage policy applied the manager
  override to every dashboard, including ones with `owner_id` set to a
  specific individual (a "personal" dashboard, by this schema's own
  convention).
- **Actual fix:** Manager override now only applies when `owner_id IS
  NULL` (a shared/company dashboard); personal dashboards are editable
  only by their owner. `0013_security_hardening.sql`.

### SEC-18 — Notification recipients could rewrite their own notification's content
- **Severity:** Medium
- **Risk:** `users mark own notifications read` only checked
  `recipient_id = auth.uid()`, with no column restriction — a user
  could change `title`, `body`, `link`, `type`, `actor_id`, even
  `company_id` on their own notification row.
- **Impact:** Low real-world exploitability (it's self-scoped data —
  affects only what the actor themselves sees), but it defeats the
  purpose of a notification as a record of something that actually
  happened, and a freely-editable `link` field on something the UI
  navigates to on click is exactly the shape of a self-inflicted
  open-redirect-style footgun even if not exploitable against others
  today.
- **Actual fix:** New generic `forbid_columns_except()` trigger
  (allow-list instead of block-list, since almost every column should
  be immutable here) restricting updates to `is_read`/`read_at` only.
  Verified: forging a title fails (Test 10); the legitimate
  is_read/read_at update still succeeds.

### SEC-19 — Any company member could forge entries in the company activity feed
- **Severity:** Medium
- **Risk:** `activity_logs`' INSERT policy allowed `actor_id = auth.uid()
  OR actor_id IS NULL` with completely free-form `action`/`entity_type`/
  `entity_id`/`metadata`, and no check that the referenced entity
  actually exists or belongs to the company.
- **Impact:** Any employee could plant fabricated entries in the
  company-wide "Recent activity" feed everyone sees on the Dashboard —
  a real social-engineering/misinformation vector inside the product
  (e.g., framing a coworker, faking an announcement).
- **Recommended fix:** Require the real actor (no `NULL` escape hatch
  from a client) and constrain `entity_type` to a known vocabulary.
- **Actual fix:** Tightened INSERT policy (`actor_id = auth.uid()`,
  no null branch) plus a `CHECK` constraint on `entity_type`,
  `0013_security_hardening.sql`. Real activity generation now happens
  exclusively via trusted SECURITY DEFINER triggers (FUNC-01), so
  client-side inserts are no longer the actual path for legitimate
  entries either.

### SEC-20 — Audit logs, the security/compliance trail, were forgeable by any authenticated user
- **Severity:** Critical
- **Risk:** `members write audit logs for their own actions` allowed
  `actor_id = auth.uid() OR actor_id IS NULL` with entirely free-form
  `action`/`target_type`/`target_id`/`ip_address`/`metadata`.
- **Impact:** This directly contradicted the claim (made in this
  project's own original `docs/SECURITY.md`) that `audit_logs` is
  "genuinely immutable from the client." Immutable-after-write is
  worthless if the write itself is unrestricted: any user could plant
  a fake `member.role_changed` event, flood the log to bury a real
  incident, or forge an alibi. An audit log a bad actor can write to is
  not an audit log.
- **Recommended fix:** Remove client INSERT access to the table
  entirely; require all writes through a function that pins
  `actor_id`/company membership server-side.
- **Actual fix:** Dropped the INSERT policy — the table now has **no**
  client-facing write path at all. Added `log_audit_event(company_id,
  action, target_type, target_id, metadata)`, `SECURITY DEFINER`,
  which sets `actor_id := auth.uid()` internally (the caller cannot
  override it) and verifies company membership before writing;
  `EXECUTE` revoked from `PUBLIC`, granted only to `authenticated`.
  Verified: a direct `INSERT INTO audit_logs` fails (Test 5); the RPC
  succeeds and records the real caller (Test 6); calling it for a
  company the caller doesn't belong to fails (Test 7).
  **Residual, disclosed limitation:** the RPC still trusts the calling
  application's *judgment* about what `action`/`metadata` to send —
  identity and tenant cannot be spoofed, but a compromised client could
  still log something misleading about itself. Closing that fully
  would mean moving all sensitive mutations behind a trusted backend,
  which is a bigger architectural change than this pass — documented
  here rather than silently assumed away.

### SEC-21 — `global_search()` relied entirely on per-table RLS rather than also asserting membership itself
- **Severity:** Low (not exploitable today; hardened as defense-in-depth)
- **Risk:** The function took `p_company_id` as a fully client-controlled
  parameter and never checked the caller was actually a member of it
  before querying.
- **Impact analysis:** Confirmed **not** currently exploitable — it's
  `SECURITY INVOKER`, so every unioned table's own RLS (`is_company_member`,
  channel membership, document access level) still applies per row, and
  a non-member querying any company they don't belong to gets zero rows
  back (verified: Test 13, Bob gets 0 hits querying Acme). But this
  safety was *incidental* — nothing in the function itself asserted it,
  so a future branch added against a table with weaker RLS would
  silently reopen the leak.
- **Actual fix:** Added an explicit `public.is_company_member(p_company_id)`
  guard to every branch's `WHERE` clause, so the function fails safe on
  its own terms rather than by accident of what else happens to be
  true. `0013_security_hardening.sql`.

### SEC-22 — Missing data-integrity constraints
- **Severity:** Medium
- **Risk:** `companies.slug` (used directly as a URL path segment) had
  no format constraint — a direct API insert bypassing the app's own
  `slugify()` could set an arbitrary string. `files.storage_path` had
  no check that it actually started with the row's own `company_id`.
- **Actual fix:** `companies_slug_format` CHECK (`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`);
  `files_storage_path_matches_company` CHECK (`storage_path LIKE
  company_id::text || '/%'`); `files_size_limit` CHECK (0 < size ≤ 200 MB).
  `0013_security_hardening.sql`.

### SEC-23 — No file size or MIME-type limits anywhere
- **Severity:** Medium
- **Risk:** The `company-files`/`avatars` Storage buckets had no
  `file_size_limit`/`allowed_mime_types` set, and the `files` table had
  no size CHECK — any authenticated member could upload arbitrarily
  large or arbitrarily-typed files.
- **Actual fix:** Bucket-level `file_size_limit` (200 MB / 5 MB for
  avatars) and `allowed_mime_types` allow-lists matching the product
  brief's supported types (PDF/DOCX/XLSX/PPTX/images/video/etc.),
  `0013_security_hardening.sql`; matching client-side validation
  (`src/lib/file-policy.ts`) for fast UX feedback, with the bucket/DB
  constraints as the actual enforcement boundary. Verified: bucket
  config confirmed present post-migration (Test 15).
- **Residual gap (GAP-02):** No virus/malware scanning. See §"Missing"
  below — this requires a third-party scanning service this session
  has no credentials for; the architecture for adding one (an Edge
  Function triggered on upload, a `scan_status` column, quarantine
  before the file is servable) is documented but not implemented.

### SEC-24 — Notifications were insertable by any member for any recipient, with arbitrary content
- **Severity:** Medium
- **Risk:** `system inserts notifications` required only
  `is_company_member(company_id)` — no check on `recipient_id` (any
  user, in any company) or on content.
- **Impact:** A spam/social-engineering vector — any member could send
  any user a fabricated "task_assigned"-looking notification with
  arbitrary title/body/link. Compounded by FUNC-01 (nothing legitimate
  used this path anyway, so closing it costs nothing functionally).
- **Actual fix:** Dropped the policy entirely — no client INSERT path
  remains. All real notifications now flow through `create_notification()`,
  `SECURITY DEFINER`, `EXECUTE` revoked from `PUBLIC` and never granted
  to `authenticated` (it's trigger-internal only). Verified: a direct
  insert fails; a direct RPC call to `create_notification` fails with
  "permission denied" (Test 8); the real trigger-driven flow (task
  assignment) succeeds and produces exactly the expected row (Test 9).

---

## 2. Functional gaps (found while auditing "does this actually work")

### FUNC-01 — Nothing ever created a notification or activity-log row
- **Severity:** High (the entire Notifications module and the
  Dashboard's "Recent activity" widget were non-functional)
- **Evidence:** `grep -rn 'from("notifications")\|from("activity_logs")' src/`
  before this pass showed only `SELECT`/`UPDATE` call sites — zero
  `INSERT`s anywhere in the application, and no database trigger
  produced them either. The bell, the realtime subscription, and the
  widget were all wired correctly against an always-empty data source.
- **Actual fix:** Trigger-driven generation for the highest-value
  events: task assignment, task comments (notifying the task's creator
  and other assignees, never the commenter), document sharing, task
  creation/status-change, document/project creation, and member joins
  (`0014_notifications_and_invitations.sql`). This is not exhaustive —
  it covers the events a user would most immediately expect, not every
  possible one; see ROADMAP for what's left.

### FUNC-02 — Invitations could be sent but never accepted
- **Severity:** High (a company literally could not grow its team)
- **Evidence:** `company_invitations` rows were created by Settings →
  Members → Invite, but no code path anywhere turned an invitation into
  a `company_members` row.
- **Actual fix:** `accept_company_invitation(token)` RPC — validates
  the token, expiry, and that the accepting user's email matches the
  invite; inserts (or reactivates) the membership; marks the invite
  accepted; notifies the inviter. New `/accept-invite?token=...` route
  and page, wired from a "Copy invite link" action in Settings → Members
  (email delivery isn't connected yet, so this is the real, working
  distribution mechanism today — see ROADMAP). Verified end-to-end:
  Test 11 creates an invite as Alice, accepts it as a new user "Dave,"
  confirms `role = 'manager'`, `status = 'active'`.

### FUNC-03 — Storage quota was purely cosmetic
- **Severity:** Medium
- **Evidence:** `companies.storage_quota_bytes` and the Billing/Dashboard
  "storage usage" widgets displayed a number; nothing compared it
  against actual usage before accepting an upload.
- **Actual fix:** `check_storage_quota()` BEFORE INSERT trigger on
  `files`, comparing `company_storage_usage.used_bytes + incoming` against
  the quota and rejecting the upload with a clear error otherwise.
  Client-side: the upload hook now rolls back the Storage object if the
  `files` row insert is rejected for any reason (quota included), so a
  failed upload never leaves an orphaned, quota-consuming blob with no
  corresponding row. Verified: Test 12, a 1000-byte upload against a
  500-byte quota fails with `Storage quota exceeded`.

---

## 3. Authentication

### AUTH-01 — No password reset flow existed
- **Severity:** High (table-stakes for a paying-customer launch)
- **Evidence:** No "Forgot password?" link, no `resetPasswordForEmail`
  call, no page to handle the recovery session and set a new password.
- **Actual fix:** `/forgot-password` (calls `resetPasswordForEmail`,
  shows an identical confirmation regardless of whether the email
  matches an account, to avoid account enumeration) and
  `/reset-password` (listens for the `PASSWORD_RECOVERY` auth event,
  calls `updateUser({ password })`). Linked from the login page.

### AUTH-02 — `security_settings.session_timeout_minutes` was set but never enforced
- **Severity:** Medium
- **Evidence:** The Security settings page let an Admin set a timeout
  value; nothing read it anywhere else.
- **Actual fix:** `useIdleTimeout()` hook, mounted in the workspace
  shell — tracks last user activity (mouse/keyboard/scroll/touch),
  checks every 30s, and signs the user out once idle time exceeds the
  workspace's configured limit.

### Reviewed and found sound
- Session persistence/refresh: standard `@supabase/supabase-js`
  `persistSession`/`autoRefreshToken`, no custom token handling to
  second-guess.
- No XSS vectors found: `grep -rn 'dangerouslySetInnerHTML\|innerHTML\|eval(' src/`
  returns nothing — every user-generated string (task titles, chat
  messages, document/knowledge content) renders through React's default
  text escaping.
- `npm audit`: 0 vulnerabilities across 185 dependencies (prod + dev),
  checked at time of writing.
- Storage bucket isolation: `storage.objects` RLS keys off the first
  path segment of the object name, which is always the uploading
  company's own id — confirmed this holds even if a `files` table row's
  `company_id` were (hypothetically, pre-SEC-01..11-fix) desynced from
  the object's real path, because the bucket policy reads the *path*,
  not the table.

---

## 4. Performance

### PERF-01 — `global_search()` returned zero results for realistic short queries **(execution-only)**
- **Severity:** Medium (functional correctness, filed under performance
  because the fix is also the performance-correct one)
- **Evidence:** `similarity('Ship the audit fixes', 'Ship')` = 0.238,
  below pg_trgm's default 0.3 threshold for the `%` operator used
  throughout the function — confirmed by direct query. A user searching
  "Ship" for a task titled "Ship the audit fixes" got nothing.
- **Actual fix:** Replaced `similarity()`/`%` with `word_similarity()`/`<%`
  throughout — the operator pg_trgm ships specifically for "does this
  short query match some word-boundary-aligned substring of the
  target" (`word_similarity('Ship', 'Ship the audit fixes')` = 1.0). No
  index change needed — the existing `gin_trgm_ops` indexes already
  support it. Verified: Test 14, the same query that returned 0 rows
  before now finds the task.
- Also added missing trigram indexes that meant two of the seven search
  branches (`projects.name`, `profiles.full_name`/`email`) had no index
  to use at all: `idx_projects_name_trgm`, `idx_profiles_full_name_trgm`,
  `idx_profiles_email_trgm`.

### PERF-02 — Single 811 KB JS bundle
- **Severity:** Medium
- **Evidence:** `npm run build` before this pass: one 811.55 KB
  (232.92 KB gzip) bundle, with Vite's own "chunk larger than 500 KB"
  warning.
- **Actual fix:** Route-level code-splitting via `React.lazy()` for
  every page behind the authenticated workspace shell (landing/auth/
  onboarding stay eager since they're the actual first paint for a
  signed-out visitor and are small). **Measured result:** main entry
  bundle now 362.39 KB (112.57 KB gzip) — a 55% reduction — with the
  500 KB warning gone entirely; every module page loads as its own
  1–19 KB chunk fetched on navigation.
- Added composite indexes matching the app's actual query patterns
  (`tasks(company_id, project_id) WHERE parent_task_id IS NULL`,
  `documents(company_id, folder_id) WHERE is_archived = false`, etc.)
  that were missing from the original schema.

### Not verified (and why)
- **"<2 second page loads" and "500+ concurrent users"** cannot be
  honestly claimed without a deployed environment and real traffic —
  no Supabase project or hosting is provisioned in this session (see
  README "Getting started"). What's verifiable without one — bundle
  size, missing indexes, N+1 query patterns, RLS policy cost — has been
  addressed and measured above. Load testing belongs in ROADMAP Phase 1
  ("Beta-ready"), against a real staging deployment.
- No query-level `EXPLAIN ANALYZE` profiling at production data volumes
  was performed (there is no production data yet). The composite
  indexes above are reasoned from the app's actual query shapes, not
  from observed slow-query logs.

---

## 5. What's explicitly still Missing

Not fixed in this pass, listed here rather than silently omitted:

- **Plan-based feature enforcement at the RLS layer** (GAP-01) — plan
  gating today is client-side UX only (locked nav items, upsell
  prompts). See `docs/SUBSCRIPTION_MODEL.md` "Enforcement gap" for the
  concrete fix and why it was deliberately not done blind in this pass
  (it touches every gated module's RLS and deserves its own review).
- **Virus/malware scanning on uploads** (GAP-02) — architecture
  documented (Edge Function on upload, `scan_status` column, quarantine
  before serving), not implemented; requires a third-party scanning
  service this session has no credentials to provision.
- **IP allow-listing** — `security_settings.allowed_ip_ranges` is
  stored, not enforced.
- **Enforced MFA at login** — the `require_mfa` toggle exists; nothing
  blocks sign-in for a member without an enrolled factor yet.
- **Seat-limit enforcement at invite time** — `max_members` is
  informational; nothing blocks a new invite once a plan's limit is hit.
- Chat **read receipts** and **in-message file attachments** — presence
  (online/typing) and reactions/edit/delete are real and verified; "who
  has read this" and attaching a file to a chat message were not built
  in this pass.
- HR **Departments UI** and **Attendance** — the `hr_departments` table
  exists and is referenced by `hr_employees.department_id`, but no
  screen manages departments; attendance/timesheets were not modeled at
  all (leave requests were, and are fully working).
- **Active-user-count dashboard widget** specifically — "Team
  productivity" reports total active members, but no widget shows who's
  *currently* online (that needs a workspace-wide presence channel; the
  presence infrastructure built for Chat is per-channel, not global).
  (The **Revenue Metrics** widget named in the same brief was added —
  `0020_revenue_widget.sql` plus `widget-renderer.tsx` — since the
  Finance module already produces the ledger data it needs.)
