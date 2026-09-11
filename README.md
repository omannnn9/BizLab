# BizLab

The virtual operating system for modern businesses — tasks & projects,
documents, file storage, team chat, whiteboards, dashboards and a company
knowledge base, unified into one multi-tenant SaaS platform.

## Documentation

| Doc | Covers |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, tech stack rationale, API architecture, folder structure |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Full schema, entity relationship diagram, migration-by-migration breakdown |
| [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) | RBAC model, permission matrix, document-level sharing |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth, encryption, audit logging, tenant isolation guarantees |
| [`docs/SUBSCRIPTION_MODEL.md`](docs/SUBSCRIPTION_MODEL.md) | Plans, pricing, billing architecture |
| [`docs/UX_WIREFRAMES.md`](docs/UX_WIREFRAMES.md) | Wireframes for every module + core user journeys |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What's built, what's deferred (and why), phased plan through AI assistant + enterprise |

## Tech stack

React 19 + TypeScript + Vite · Tailwind v4 + shadcn/ui · TanStack Query ·
React Router · Supabase (Postgres + Auth + Realtime + Storage) · deployed
on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

A live Supabase project (`BizLab`, `eu-west-1`) backs this repo with all
21 migrations applied and verified — see `docs/AUDIT_REPORT.md` for what
was found and fixed while doing that (including two real,
execution-only-discoverable issues: a spoofable notifications/activity-log
RPC gap, and a storage-usage view that bypassed tenant RLS). `.env.local`
is git-ignored; ask whoever set up the project for its URL and
publishable key, or provision your own per below.

### Setting up your own Supabase project

1. Create a Supabase project (via the [dashboard](https://supabase.com/dashboard)
   or the Supabase MCP tools if you're working in an environment that has
   them).
2. Run the migrations in `supabase/migrations/` **in order** (0001 →
   0021) — via `supabase db push`, the Supabase SQL editor, or
   `mcp__Supabase__apply_migration` one file at a time.
3. Copy your project's URL and anon/publishable key into `.env.local`
   (see `.env.example`).
4. `npm run dev`, sign up, and you'll land in the onboarding flow that
   creates your first company workspace.

## Scripts

```bash
npm run dev       # start the Vite dev server
npm run build      # typecheck (tsc -b) + production build
npm run lint       # oxlint
npm run preview    # preview the production build locally
```

## Project structure

```
src/
├── components/    # ui/ (shadcn primitives) + layout/, shared/, tasks/, projects/, dashboard/
├── hooks/         # one file per data domain — the only place Supabase queries live
├── providers/     # Auth, Workspace, Query context providers
├── pages/         # route components, grouped per module
├── routes/        # RequireAuth guard
├── lib/           # supabase client, permissions matrix, utils
└── types/         # hand-written types mirroring supabase/migrations

supabase/migrations/   # 0001-0021, the full database schema + RLS policies
docs/                    # architecture, schema, permissions, security, roadmap
```

See `docs/ARCHITECTURE.md` for the full breakdown.
