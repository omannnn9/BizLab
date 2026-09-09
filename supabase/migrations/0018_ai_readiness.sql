-- =====================================================================
-- BizLab — 0018: AI-readiness infrastructure.
--
-- Per the product brief: "Prepare BizLab for AI. Build infrastructure
-- for company knowledge retrieval, document search, task generation,
-- meeting summaries, chat summaries. Do not implement AI features yet."
--
-- This migration adds the storage and job-queue shape a future
-- `ai-assistant` Edge Function needs (see docs/ROADMAP.md Phase 4) —
-- no model is called anywhere in this codebase, and nothing here
-- changes behavior until something starts writing to these tables.
-- =====================================================================

create extension if not exists vector;

-- ---------------------------------------------------------------------
-- Embeddings for retrieval-augmented "company knowledge" search.
-- One row per (source_type, source_id, chunk_index) so a long document
-- can be split into multiple retrievable chunks; text-embedding-3-small
-- and most current OpenAI/Voyage/Cohere embedding models produce
-- 1536-dim vectors, used here as the default — swap the dimension if a
-- different model is chosen when this is actually wired up.
-- ---------------------------------------------------------------------
create table public.ai_embeddings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_type text not null check (source_type in ('document', 'knowledge_article', 'chat_message', 'task')),
  source_id uuid not null,
  chunk_index int not null default 0,
  chunk_text text not null,
  embedding vector(1536),
  model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

create index idx_ai_embeddings_company on public.ai_embeddings (company_id, source_type);
-- Approximate nearest-neighbor index for cosine similarity search —
-- built once there's enough data to make it worthwhile to plan around;
-- harmless (just unused) until then.
create index idx_ai_embeddings_vector on public.ai_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------
-- A job queue rather than a synchronous trigger: embedding a
-- 10-page document on every keystroke would be both slow and
-- expensive. Application code (or, later, a database trigger) enqueues
-- a row here whenever a document/article/task changes meaningfully;
-- a worker (Edge Function or cron) claims pending jobs, calls an
-- embedding model, and writes the results into ai_embeddings.
-- ---------------------------------------------------------------------
create type public.ai_job_status as enum ('pending', 'processing', 'done', 'failed');

create table public.ai_embedding_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_type text not null check (source_type in ('document', 'knowledge_article', 'chat_message', 'task')),
  source_id uuid not null,
  status public.ai_job_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_ai_embedding_jobs_pending on public.ai_embedding_jobs (status, created_at) where status = 'pending';

-- ---------------------------------------------------------------------
-- Every AI-assisted action (a summary, a generated task, an answer to
-- a company-knowledge question) gets logged here once implemented —
-- both for the user-facing "why did the AI say this" trail and so the
-- audit_logs pattern extends naturally to AI actions instead of AI
-- being a black box bolted on separately.
-- ---------------------------------------------------------------------
create type public.ai_interaction_type as enum (
  'chat_summary', 'meeting_summary', 'task_generation', 'knowledge_search', 'report_generation'
);

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  type public.ai_interaction_type not null,
  input_summary text,
  output jsonb not null default '{}'::jsonb,
  source_entity_type text,
  source_entity_id uuid,
  model text,
  created_at timestamptz not null default now()
);

create index idx_ai_interactions_company on public.ai_interactions (company_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS — same tenant-isolation shape as everything else. ai_embeddings
-- and ai_embedding_jobs are written only by trusted server-side code
-- (an Edge Function using the service role, which bypasses RLS
-- entirely) — client access is read-only, matching "search my
-- company's knowledge" without exposing raw embedding-write access
-- that could be used to poison another tenant's retrieval results.
-- ---------------------------------------------------------------------
alter table public.ai_embeddings enable row level security;
alter table public.ai_embedding_jobs enable row level security;
alter table public.ai_interactions enable row level security;

create policy "members read their company's embeddings" on public.ai_embeddings for select
  using (public.is_company_member(company_id));

create policy "members view their company's embedding jobs" on public.ai_embedding_jobs for select
  using (public.is_company_member(company_id));

create policy "members view their company's ai interactions" on public.ai_interactions for select
  using (public.is_company_member(company_id));
-- No INSERT/UPDATE/DELETE policies on any of the three: until the
-- ai-assistant Edge Function exists, nothing should write here at all,
-- and once it does, it will run with the service role (which bypasses
-- RLS), the same trust boundary audit_logs already uses (0013 SEC-20).

create trigger trg_ai_embeddings_immutable_keys before update on public.ai_embeddings
  for each row execute function public.forbid_column_update('company_id');
