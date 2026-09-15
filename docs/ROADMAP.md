# BizLab — Implementation Roadmap

## Product & design reimagining — Phase 1 of N

A full identity/IA/visual overhaul was requested: stop adding modules,
redesign around workflows instead of CRUD screens, make BizLab feel like
"the digital headquarters of OD Holdings" instead of a generic SaaS
dashboard. That is a multi-week effort, not a single pass — this is the
foundation phase, done for real (not a mockup), with the rest staged
honestly rather than rushed or faked.

**Shipped:**
- **A real design system, not default shadcn.** The old primary color
  was indigo-500 — the single most default "didn't decide" hue in SaaS.
  Replaced with a deliberate signal-teal identity (already validated in
  the Login/Dashboard/Admin design exploration, now actually wired into
  every token instead of staying a mockup). Three-face type system —
  Archivo for anything that should read as a heading or a big number,
  IBM Plex Sans as the dense-UI workhorse, IBM Plex Mono wherever digits
  line up — replacing "Inter", which, it turns out, was never actually
  loaded anywhere (no `@font-face`, no link tag) and had been silently
  falling back to the OS default the entire time. Motion tokens (a
  considered ease-out, not Tailwind's default) applied globally so every
  existing `transition-*` utility already in the app picks it up
  automatically. The sidebar is now deliberately dark in both themes —
  brand chrome, not a content surface that should flip with light/dark.
- **New information architecture.** Home, My Work, and Companies are now
  real, separate, first-class destinations instead of one undifferentiated
  "Dashboard." Work and Collaboration are grouped explicitly in the nav.
  Command Center is a new platform-admin-only cross-company view.
- **Home, reinvented.** Was a configurable widget grid; is now a
  greeting, Today's Focus (what's actually due or overdue for *you*,
  not the whole company), Upcoming Deadlines, Recent Activity, and
  Active Projects — all real queries, nothing decorative. The old
  configurable-widgets dashboard (personal dashboards, quick links,
  drag-to-reorder) still exists and still works — it's the "Dashboards"
  link, not deleted, just no longer the front door.
- **My Work**: Today / This Week / Waiting on Others / Recently
  Completed, genuinely scoped to the signed-in viewer. Building this
  surfaced a real, pre-existing bug: the old "My tasks" dashboard stat
  counted *every open task in the company* for *every viewer* — it had
  no assignee filter at all. Fixed at the source (`useDashboardStats`).
- **Companies hub**: every company you belong to, with real project and
  open-task counts (grouped queries, not N+1), not just a name in a
  dropdown.
- **Command Center**: portfolio-wide rollup for platform admins — company
  health (completion rate, open/overdue tasks per company) and critical
  deadlines across every company, all real. "Strategic initiatives,"
  "major risks," and "open decisions" were part of the original ask but
  have no backing data model at all — deliberately not faked here; see
  Phase 2.
- Fixed a dead link found along the way: the workspace switcher's "New
  workspace" pointed at a route that never existed.

**Phase 2, started:**
- **Chat's empty state**, the one place left with an emoji standing in
  for real design ("No messages yet. Say hello 👋"), now uses the same
  `EmptyState` component as the rest of the app, with copy that names
  the actual channel.
- **Document writing comfort**: the shared Tiptap editor (Documents and
  Knowledge both use it) was rendering at `prose-sm` — 14px, tight
  leading, no real heading or blockquote treatment. Now reads at a real
  body size with relaxed paragraph leading, display-face headings, and
  a proper blockquote rule instead of prose defaults. The toolbar is
  sticky with a soft elevated surface instead of a flat bar that
  scrolls away. Title input moved to the display face with more
  breathing room above it. Still not Notion-level (no slash commands,
  no inline block drag handles, no comment anchoring to text ranges)
  — that's a bigger lift, tracked below.

**Explicitly not done yet** (this was always going to be staged):
- Company home pages (Mission / Objectives / Roadmap / KPIs / Recent
  Decisions) — needs new data modeling (none of those are entities
  today), not just UI.
- Projects as the true center of execution (tasks/docs/files/whiteboards
  embedded in one project view instead of separate top-level modules).
- Document editor still lacks slash commands, drag-to-reorder blocks,
  and comments anchored to a text selection (comments are page-level
  today) — the typography pass above is legibility, not the full
  Notion-grade editing model.
- File relationship context, chat→task conversion, richer whiteboard
  templates.
- Strategic initiatives / risks / decisions tracking (new tables).
- A full empty-state rewrite across every module (Home, My Work, and
  now Chat got real ones; most of the rest still show a plain "No X
  yet" line — sub-page lists, comment threads, and version history are
  intentionally left as terse inline text, not full EmptyState blocks,
  since that component is sized for whole-section empty states, not a
  two-line list under a header).
- Broader motion pass (page transitions, workspace switching, modals) —
  the token-level foundation (global transition timing) is in, and
  Dialog already animates in/out with fade+zoom; nothing beyond that
  has been reviewed yet.

## What's built today (this repository)

A working, deployable internal platform for OD Holdings and its
companies, not a mockup — see `README.md` for the internal-only access
model (no public signup, admin-provisioned accounts and companies only).

- **Multi-tenant foundation**: companies, workspace switching, RBAC (5
  roles), fine-grained document ACLs, full RLS tenant isolation,
  a platform-admin role that spans every company (`supabase/migrations/
  0001-0023`).
- **Admin-only access model**: no public signup; a platform admin
  creates companies and invites every user via a real Supabase Auth
  invite email (Edge Function `invite-user`); disabled users lose all
  data access immediately via RLS, not just a UI hide. A platform admin
  can create a new company workspace directly from the workspace
  picker (`/workspaces`), not just buried in Administration → Companies
  — the picker no longer auto-skips past itself for an admin with only
  one membership, so "Create workspace" stays reachable.
- **Tasks & Projects**: full CRUD, List/Kanban/Calendar/**Timeline
  (Gantt)** views, drag-and-drop status changes, delegation (assignees),
  priorities, due dates, comments, milestones, project progress
  tracking. Delegating a task notifies the assignee, and every assignee
  gets a one-time deadline reminder as the due date approaches (hourly
  `pg_cron` job — the notification type existed in schema from the
  start but nothing ever fired it). Fixed a real bug where *editing* an
  existing task silently dropped any assignee changes on save — only
  task creation actually persisted assignees before.
- **Dashboards**: configurable widgets backed by real queries — task
  completion, deadlines, storage, activity, channel activity, and
  **quick links** (pin buttons to outside tools/docs, editable inline).
  Every widget type renders real data, none fall through to a
  placeholder, and the "Add widget" picker offers exactly the set that
  actually renders.
- **Documents**: folder tree, a real Tiptap rich-text editor (bold/
  italic/underline/strike, headings, bullet/numbered/task lists,
  blockquotes, code blocks, links), autosave + version history/restore,
  per-document sharing UI (view/comment/edit/full_control), comments.
- **File Storage**: drag-and-drop upload with a friendly pre-upload
  quota check (not just a raw DB-trigger error after the fact), folders,
  signed-URL downloads, and **in-app live editing**: open an uploaded
  .docx and edit it in the same rich-text editor Documents uses (import
  via mammoth, save back to a real .docx via the `docx` library), open
  an uploaded .xlsx as an editable cell grid (SheetJS) and save back to
  real .xlsx, or view a PDF/image inline. Any company member can edit a
  shared file now, not just its uploader (`0026_files_collab_edit.sql`
  fixed a real gap where the RLS policy was stricter than the app's own
  documented permission model). PDF content itself isn't editable —
  true PDF editing is out of scope — just viewable in-app.
- **Team Chat**: channels, realtime messages, reactions, typing/presence
  indicators, file attachments, **threaded replies**, auto-seeded
  default channels.
- **Whiteboards**: infinite pan/zoom canvas, sticky notes, shapes, a
  dedicated text tool, select + delete, real loading/error states
  (opening a board that fails to load used to render nothing at all
  and looked exactly like a permanently blank canvas).
- **Knowledge Hub**: categorized articles (SOP/policy/process/training/
  onboarding), the same Tiptap rich-text editor as Documents,
  draft/publish workflow.
- **Notifications**: realtime, per-user, mark read/unread.
- **Global search**: cross-entity (tasks/projects/docs/files/chat/
  knowledge/people), RLS-safe.
- **Security**: real TOTP multi-factor authentication (enroll via
  Settings → Security; a company can require it, which forces
  enrollment on next sign-in for anyone without a factor), session
  timeout enforcement, a real CSV compliance-report export, an audit
  log covering role changes, member removal, document-sharing changes,
  and security-policy changes.
- **Settings**: company profile, member management + invitations, role
  changes, security policy toggles, audit log viewer + export. No
  billing/plan gating — every module is available to every company.
  Platform admins can set each company's storage limit directly
  (Administration → Companies → Storage limit) — the flat 5 GB default
  from this app's original plan-gated design is gone; new companies now
  start at 500 GB and any admin can raise or lower it per company with
  no billing tier in the way.
- **Dashboards — customizing the shared one**: fixed a real bug where
  every employee saw working "Add widget"/remove controls on the
  shared company dashboard, but only managers/admins/owners could
  actually save a change — the UI's permission check didn't match the
  database's. A manager+ (which includes platform admins acting in a
  company they belong to) can now actually customize the dashboard
  everyone in the company sees; other roles no longer see controls
  that silently fail. Personal dashboards can now be deleted (there
  was no delete path at all before — create-only). Widget cards got a
  real visual pass: a tone-colored icon chip per widget type, bold
  tabular-numeral stats, urgency-colored deadline badges (overdue /
  due today / due soon), a usage-colored storage meter, avatars on
  the activity feed, and a proper empty state — the plain
  icon-less/color-less cards read as noticeably flatter than the rest
  of the app.

## Explicitly deferred (and why)

A few things remain **not** built, each for a concrete reason rather
than an oversight:

| Item | Why deferred |
|---|---|
| Single sign-on (SSO/SAML) | The `sso_enabled` toggle exists but doing anything with it requires an actual external identity provider (Okta, Azure AD, etc.) to configure against — not something to fabricate |
| Live multi-cursor editing (docs/whiteboards) | Current model is "load, edit, debounce-save" — real-time collaborative cursors need Realtime Presence/Broadcast wiring on top of what exists |
| AI Assistant | Explicitly scoped as "prepare infrastructure, don't implement" — see below |
| IP allow-listing enforcement | `security_settings.allowed_ip_ranges` exists in schema; enforcing it needs a server-side IP-aware layer (Edge Function or middleware) in front of the SPA, which is a different architecture question worth its own decision |

## Phased plan

### Phase 1 — Collaboration depth
1. Realtime Presence + Broadcast for live cursors in Documents and
   Whiteboards.
2. Connectors/mind-map edges in Whiteboards (beyond sticky notes/shapes).
3. Mobile-responsive pass (the shell is responsive-ready via Tailwind but
   hasn't had a dedicated mobile UX pass — sidebar → bottom nav, etc.)

### Phase 2 — AI Assistant
The schema and access model were built so this phase adds an Edge
Function and some UI, not a re-architecture:
1. `ai-assistant` Edge Function, called with the *user's* JWT (not a
   service key) so every answer/action is automatically scoped by the
   same RLS the rest of the app uses.
2. **Summarize meetings/chats**: feed a channel's `chat_messages` or a
   document's version history into the model, return a summary; store it
   as a `knowledge_articles` draft or a `task_comments` entry.
3. **Generate tasks**: parse a document or chat thread into structured
   `tasks` inserts (title/description/assignee suggestions), presented
   for one-click confirm rather than silent auto-creation.
4. **Search company knowledge (RAG)**: embed `documents.content` and
   `knowledge_articles.content` into a vector column (`pgvector`
   extension — Supabase supports it natively), retrieve via similarity
   search scoped by the same `company_id`/RLS as everything else.
5. **Answer company questions / generate reports**: compose
   `activity_logs` + task/project aggregates into natural-language
   reports on demand.

### Phase 3 — Enterprise-grade hardening
1. Real SSO/SAML once an identity provider is chosen (Supabase Auth
   Enterprise SSO).
2. IP allow-listing enforcement (`security_settings.allowed_ip_ranges`).
3. Data residency / dedicated-project isolation option for regulated
   entities (documented escape hatch from the shared-RLS model — see
   ARCHITECTURE.md §3).
4. SOC 2 program (organizational — audit logging, access reviews and
   incident response process, not purely a code change).

## Non-goals (for now)

- Native mobile apps — the responsive web app is the mobile story until
  usage data justifies native investment.
- On-premise/self-hosted deployment — Supabase + Vercel is the target
  architecture; self-hosting Supabase is possible but not a near-term
  priority.
- Public/commercial features (billing, self-service signup, marketing
  site) — BizLab is an internal platform for OD Holdings and its
  companies, not a product sold externally.
