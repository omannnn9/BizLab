# BizLab — UX Wireframes & User Journeys

These wireframes describe the actual shipped layouts (see `src/pages/**`
and `src/components/layout/**`), not aspirational mockups — every box
below corresponds to a real, working component.

## Design principles

1. **One shell, every module.** Sidebar (fixed module nav) + Topbar
   (workspace switcher, global search, notifications, user menu) never
   change shape across modules — only the content pane does. This is
   what makes the product feel like "one elegant platform" instead of
   seven bolted-together tools.
2. **Every list has an obvious create action** top-right, every item
   opens either a dialog (fast, for tasks/projects) or a dedicated page
   (for content you spend time in: documents, whiteboards, knowledge
   articles).
3. **Never block on load** — skeletons over spinner-only screens, data
   fetched per-module so switching modules never re-fetches the shell.

## App shell

```
┌───────────────┬──────────────────────────────────────────────────────────┐
│  BizLab   ▾    │  [Workspace ▾]   [ 🔍 Search tasks, docs…       ]  🔔 👤 │
│                ├──────────────────────────────────────────────────────────┤
│  ▤ Dashboard   │                                                          │
│  ✓ Tasks       │                                                          │
│  ▥ Projects    │                     <module content>                    │
│  📄 Documents  │                                                          │
│  📁 Files      │                                                          │
│  💬 Chat       │                                                          │
│  ✎ Whiteboards │                                                          │
│  📖 Knowledge  │                                                          │
│                │                                                          │
│  ⚙ Settings    │                                                          │
│  Tablo Inc.    │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

Sidebar: `src/components/layout/sidebar.tsx`. Topbar:
`src/components/layout/topbar.tsx`. This shell renders once per workspace
(`WorkspaceLayout`) and every module route is an `<Outlet />` inside it.

## Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Welcome back, Oman                              [ + Add widget ▾ ]      │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─Task completion──┐ ┌─My tasks────────┐ ┌─Storage usage──────────────┐  │
│ │  68%              │ │  7               │ │  2.1 GB ▓▓▓▓░░░░░░ 21%     │  │
│ │  ▓▓▓▓▓▓▓░░░       │ │  open tasks      │ │  of 10 GB used              │  │
│ └───────────────────┘ └──────────────────┘ └─────────────────────────────┘│
│ ┌─Upcoming deadlines──────────────┐ ┌─Recent activity──────────────────┐ │
│ │ Redesign landing page   Mar 12  │ │ Jane completed task X   2h ago    │ │
│ │ Q1 budget review        Mar 14  │ │ Priya created Project Y  5h ago   │ │
│ └──────────────────────────────────┘ └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

Widgets are user-configurable (add/remove) per `dashboard_widgets`; every
number shown is a real query against the workspace's data
(`use-dashboard.ts`), not placeholder content.

## Tasks — Kanban

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Tasks                          [List] [Kanban] [Calendar]   [+ New task] │
├──────────────────────────────────────────────────────────────────────────┤
│  Backlog (3)   To do (5)     In progress (2)   In review (1)   Done (12) │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐      ┌──────────┐   ┌────────┐ │
│ │ Task card│  │ Task card│  │ Task card│      │ Task card│   │  ...   │ │
│ │ Project• │  │ 🔴Urgent │  │ 🟡Medium │      │          │   │        │ │
│ │ 👤👤 Mar3│  │ 👤 Mar 5 │  │ 👤👤     │      │ 👤       │   │        │ │
│ └──────────┘  └──────────┘  └──────────┘      └──────────┘   └────────┘ │
│      ⋮ drag cards between columns to change status ⋮                    │
└──────────────────────────────────────────────────────────────────────────┘
```

Drag-and-drop between columns updates `tasks.status` directly
(`kanban-board.tsx`). Clicking a card opens the task dialog: title,
description, status, priority, project, due date, assignees, comments,
delete — one surface for everything about a task.

## Documents

```
┌────────────┬───────────────────────────────────────────────────────────┐
│ All docs   │ Documents                                  [+ New document]│
│ ─────────  ├───────────────────────────────────────────────────────────┤
│ Folders    │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  HR        │  │📄 Q1 OKRs│  │📄 Onboard│  │📄 Brand  │                 │
│  Sales     │  │ 2h ago   │  │ guide    │  │ guidelines│                │
│  Finance   │  └──────────┘  └──────────┘  └──────────┘                 │
│  Marketing │                                                            │
│  Operations│                                                            │
│ + New folder│                                                           │
└────────────┴───────────────────────────────────────────────────────────┘
```

Opening a document goes full-page (`document-editor-page.tsx`): title,
body, autosave indicator, and a slide-out comments panel — matching the
"docs you spend real time in" principle above.

## Chat

```
┌────────────┬───────────────────────────────────────────────────────────┐
│ # General  │  # general                                                │
│ # Announc. ├───────────────────────────────────────────────────────────┤
│ # Product  │  👤 Priya  10:02am                                        │
│ # Sales    │  Shipped the new dashboard widgets 🎉                     │
│ # Marketing│                                                            │
│ # Support  │  👤 Oman  10:05am                                         │
│ + Add      │  Looks great, testing now                                 │
│  channel   │                                                            │
│            ├───────────────────────────────────────────────────────────┤
│            │  [ Message #general                              ] [Send] │
└────────────┴───────────────────────────────────────────────────────────┘
```

Messages arrive in real time via Supabase Realtime (`use-messages.ts`) —
no polling, no manual refresh.

## Whiteboard

```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Boards        Untitled board                          [-] 100% [+]   │
├───┬────────────────────────────────────────────────────────────────────┤
│ 🗒 │                                                                    │
│ ▭ │        ┌────────────┐      ┌────────────┐                          │
│ ◯ │        │ Sticky note │      │  Rectangle │                         │
│   │        └────────────┘      └────────────┘                          │
│   │                     (infinite pannable / zoomable canvas)          │
└───┴────────────────────────────────────────────────────────────────────┘
```

Left rail adds sticky notes / rectangles / circles; drag the background to
pan, +/− to zoom. Autosaves to `whiteboards.canvas_data` (JSONB) on a
debounce.

## User journeys

### 1. First-time signup → first workspace

```
Land on marketing page → "Get started free" → Sign up (email/password)
  → confirm email (if required) → redirected to /workspaces
  → no companies yet → auto-redirected to "Create your company workspace"
  → fill name + industry → submit
  → seed_company_defaults() trigger fires:
      owner membership · 6 default channels · 5 document folders
      · default dashboard with 6 widgets · Free trial subscription
  → land on Dashboard, already populated with a usable shell
```

Zero empty-states, zero setup wizard — matches "extremely simple UX".

### 2. Existing user switching between companies (Oman: Tablo/Odax/Nova)

```
Any page → click workspace switcher (top-left) → dropdown lists all
  companies the user belongs to (role shown) → click "Odax"
  → navigates to /w/odax-xxxx/ → WorkspaceProvider resolves new company
  → sidebar/topbar re-render scoped to Odax; all open queries are keyed
    by company.id so nothing from Tablo leaks into view even for an
    instant.
```

### 3. Assigning and completing a task

```
Tasks (Kanban) → "+ New task" → fill title, assignees, due date, priority
  → task appears in "To do" column
  → assignee gets a realtime notification ("Task assigned")
  → assignee drags card to "In progress", then "Done"
  → completed_at is stamped automatically
  → Dashboard's "Task completion" widget updates on next load
```

### 4. Inviting a teammate with the right access level

```
Settings → Members → "Invite member" → enter email + role (e.g. Manager)
  → row appears under "Pending invitations"
  → (roadmap: invite email sent via Resend, accept link redeems the
     company_invitations row into a company_members row)
  → once accepted, they appear in the members list with their role badge
    and can immediately act within that role's permissions — no extra
    provisioning step.
```

### 5. Sharing a sensitive document with only Finance

```
Document → (roadmap UI: "Share" button) sets visibility = 'restricted'
  → adds Finance team members via document_permissions with 'edit'
  → everyone else — including other Employees — loses view access
    immediately (document_access_level() re-evaluates on every request,
    there's no caching to invalidate)
  → Managers/Admins retain full_control regardless, so nothing is ever
    unrecoverable by the people accountable for the workspace.
```
