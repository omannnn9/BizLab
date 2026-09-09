# BizLab — Permission Model

BizLab enforces authorization in **two layers that must always agree**:

1. **Postgres RLS** (`supabase/migrations/0002_core_tenancy.sql` and every
   subsequent migration) — the real security boundary. Every query, from
   any client, is filtered by these policies.
2. **`src/lib/permissions.ts`** — a client-side mirror used only to
   hide/disable UI controls a user couldn't use anyway. It is explicitly
   documented as *not* a security boundary; it exists purely for UX
   (don't show an "Delete project" button to someone RLS would reject).

If the two ever disagree, RLS wins — a hidden button is a bug, a visible
button that fails server-side is merely a worse UX, not a vulnerability.

## Roles

| Role | Rank | Summary |
|---|---|---|
| Owner | 5 | Full access, including billing and company deletion. Exactly one per company by default (the creator); ownership can be transferred by editing `company_members.role`. |
| Admin | 4 | Manages workspace settings, members, permission overrides, security policy. Cannot delete the company. |
| Manager | 3 | Manages projects, milestones, tasks assigned to their teams, and publishes Knowledge Hub content. |
| Employee | 2 | Standard access: create/edit tasks, documents and files; participate in chat, whiteboards, dashboards. |
| Guest | 1 | Restricted — sees only what is explicitly shared with them (via `document_permissions`, `file_shares`, or channel membership). No default create rights. |

Role comparisons use `role_rank()` (owner=5 … guest=1) so policies like
"managers and above" are a single `>=` comparison
(`has_min_role(company_id, 'manager')`), not an enum-matching list that
has to be updated every time a role is added.

## Base permission matrix

Mirrored client-side in `PERMISSION_MATRIX` (`src/lib/permissions.ts`) and
enforced server-side per-table. "View" for most resources means "company
member"; task/document/file *creation* is intentionally open to Employees
so the tool doesn't bottleneck through managers for everyday work.

| Resource | View | Create | Edit | Delete | Manage |
|---|---|---|---|---|---|
| Workspace settings | Employee | — | Admin | — | Owner |
| Billing | Admin | — | — | — | Owner |
| Members | Employee | Admin | Admin | Admin | — |
| Projects | Employee | Manager | Manager | Admin | — |
| Tasks | Employee | Employee | Employee | Manager (or creator) | — |
| Documents | per-doc¹ | Employee | per-doc¹ | per-doc¹ | — |
| Files | Employee | Employee | Uploader/Manager | Uploader/Manager | — |
| Chat | Employee (public channels) | Employee | — | — | — |
| Whiteboards | Employee | Employee | Employee | Manager (or creator) | — |
| Dashboards | Employee (shared) / owner (personal) | Employee | Manager (or owner) | Manager (or owner) | — |
| Knowledge Hub | Employee (published only) | Manager | Manager (or author) | Admin (or author) | — |
| Audit logs | Admin | — | — | — | — |

¹ Documents have **per-document access levels** layered on top of role
defaults — see below.

## Document-level sharing (fine-grained ACL)

Unlike other resources, Documents have a per-document ACL because a
company wiki needs to mix "everyone can read this" with "only Finance can
edit the comp plan":

- `documents.visibility`: `company` (default — every company member gets
  `default_access_level`) or `restricted` (only rows in
  `document_permissions` can see it at all).
- `documents.default_access_level`: `view | comment | edit | full_control`
  — the floor every company member gets when `visibility = 'company'`.
- `document_permissions(document_id, member_id, access_level)`: per-member
  overrides, always wins over the default.
- Managers and above always get `full_control`, regardless of the above
  (`document_access_level()` SQL function, 0004).

The single SQL function `document_access_level(document_id)` computes the
effective level for `auth.uid()` and is reused by every RLS policy on
`documents`, `document_versions`, `document_comments` and
`document_permissions` — so the access rules live in exactly one place.

## Fine-grained overrides beyond role

`permission_overrides(company_id, member_id, resource, action, allow)`
lets an Admin grant or revoke a specific `(resource, action)` pair for one
member without changing their role — e.g. an Employee who should be able
to delete tasks without being promoted to Manager. This table exists in
the schema (0002) so the "Permissions must be configurable" requirement
has a real home; the UI to manage overrides (beyond role changes and
per-document sharing, both of which are implemented) is listed in
ROADMAP.md as a near-term addition once real usage shows which overrides
teams actually need.

## Multi-tenant isolation

Every tenant-scoped table's RLS policy starts from
`is_company_member(company_id)` (`SECURITY DEFINER`, checks
`company_members` for an `active` row matching `auth.uid()`). Because this
function reads `company_members` regardless of the caller's own
row-visibility, there's no chicken-and-egg problem, and because *every*
table's policy funnels through it, a bug can't accidentally leak one
table cross-tenant while forgetting another — the isolation logic exists
in one function, not copy-pasted 20 times with subtle drift.

## Guest role in practice

Guests are company members like anyone else (so they appear in
`company_members`, count toward seat limits per plan), but:

- They get no default `create` rights on the base matrix.
- They only see documents/whiteboards explicitly shared with them
  (`visibility = 'restricted'` + a `document_permissions` row, or
  whiteboard/file share rows).
- They only see chat channels they've been added to (never auto-join
  public channels the way Employees+ implicitly can).

This matches common "external collaborator" use cases (a client, a
contractor) without a separate schema.
