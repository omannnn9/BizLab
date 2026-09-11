# BizLab — Implementation Roadmap

## What's built today (this repository)

A working, deployable slice of BizLab, not a mockup:

- **Multi-tenant foundation**: companies, workspace switching, RBAC (5
  roles), fine-grained document ACLs, full RLS tenant isolation
  (`supabase/migrations/0001-0012`).
- **Tasks & Projects**: full CRUD, List/Kanban/Calendar views,
  drag-and-drop status changes, assignees, priorities, due dates,
  comments, milestones, project progress tracking.
- **Dashboards**: configurable widgets backed by real queries (task
  completion, my tasks, upcoming deadlines, storage usage, recent
  activity, projects overview, team productivity).
- **Documents**: folder tree, autosaving editor, per-document sharing
  model (view/comment/edit/full_control), comments.
- **File Storage**: drag-and-drop upload, folders, signed-URL downloads,
  storage quota tracking.
- **Team Chat**: channels, realtime messages, auto-seeded default
  channels.
- **Whiteboards**: infinite pan/zoom canvas, sticky notes, shapes,
  autosave.
- **Knowledge Hub**: categorized articles (SOP/policy/process/training/
  onboarding), draft/publish workflow.
- **Notifications**: realtime, per-user, mark read/unread.
- **Global search**: cross-entity (tasks/projects/docs/files/chat/
  knowledge/people), RLS-safe.
- **Settings**: company profile, member management + invitations, role
  changes, billing/plan display, security policy toggles + audit log
  viewer.

This is genuinely usable for a small team today — a live Supabase project
now backs the repo (see README), with all 21 migrations applied and
verified, including two real, execution-only-discoverable security fixes
(see `docs/AUDIT_REPORT.md`).

## Explicitly deferred (and why)

A few things were deliberately **not** built in this pass, each for a
concrete reason rather than an oversight:

| Item | Why deferred |
|---|---|
| Stripe billing integration | Requires a real Stripe account and secret keys — not something to fabricate; schema (`company_subscriptions`, `invoices`) and UI are ready to wire up |
| Enforced MFA / SSO login | Settings/storage exist; enforcing them changes the auth flow and needs to be tested against a live Supabase Auth project |
| Rich-text editor (ProseMirror/Tiptap) for Documents/Knowledge | Current editor is a debounced plain-text field stored in the same JSONB shape a rich editor would use — swapping the *editor component* is additive, no migration needed |
| Timeline/Gantt task view | List, Kanban and Calendar are implemented; Timeline needs date-range bar layout + zoom, which is a meaningfully larger UI investment |
| Live multi-cursor editing (docs/whiteboards) | Current model is "load, edit, debounce-save" — real-time collaborative cursors need Realtime Presence/Broadcast wiring on top of what exists |
| AI Assistant | Explicitly scoped as "prepare infrastructure, don't implement" — see below |
| Automated audit-log writes on every sensitive action | `audit_logs` table + RLS + viewer UI exist; wiring a write on every role change/permission override/export is mechanical, deferred until those flows stabilize |
| Transactional email (invites, notifications digest) | No email provider connected yet; `company_invitations` already models the invite lifecycle |

## Phased plan

### Phase 1 — Beta-ready (2-3 weeks of focused work)
1. ~~Provision a real Supabase project, run migrations, connect
   `.env.local`.~~ Done — see `docs/AUDIT_REPORT.md`.
2. Wire invite emails (Resend/Postmark) so `company_invitations` actually
   notifies people.
3. Swap the Documents/Knowledge plain-text editor for Tiptap (same JSONB
   column, additive change).
4. Enforce storage quota at upload time (soft-block over quota).
5. Enforce `security_settings.require_mfa` at login.

### Phase 2 — Paid launch
1. Stripe Checkout + webhooks → `company_subscriptions`/`invoices`.
2. Enforce seat limits at invite time.
3. Document-sharing UI (the DB/RLS already supports it end-to-end).
4. Timeline/Gantt task view.
5. Audit-log write-paths for all sensitive mutations.

### Phase 3 — Collaboration depth
1. Realtime Presence + Broadcast for live cursors in Documents and
   Whiteboards.
2. Connectors/mind-map edges in Whiteboards (beyond sticky notes/shapes).
3. Chat: threads, reactions UI (schema already supports `chat_reactions`
   and `parent_message_id`), file attachments in messages.
4. Mobile-responsive pass (the shell is responsive-ready via Tailwind but
   hasn't had a dedicated mobile UX pass — sidebar → bottom nav, etc.)

### Phase 4 — AI Assistant
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

### Phase 5 — Enterprise
1. SSO/SAML per workspace (Supabase Auth Enterprise SSO).
2. IP allow-listing enforcement (`security_settings.allowed_ip_ranges`).
3. Data residency / dedicated-project isolation option for regulated
   customers (documented escape hatch from the shared-RLS model —
   see ARCHITECTURE.md §3).
4. SOC 2 program (organizational — audit logging, access reviews and
   incident response process, not purely a code change).
5. Compliance report export (Security settings already has a placeholder
   button for this).

## Non-goals (for now)

- Native mobile apps — the responsive web app is the mobile story until
  usage data justifies native investment.
- On-premise/self-hosted deployment — Supabase + Vercel is the target
  architecture; self-hosting Supabase is possible but not a near-term
  priority.
