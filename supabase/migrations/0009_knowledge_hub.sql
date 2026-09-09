-- =====================================================================
-- BizLab — 0009: Knowledge Hub (company wiki: SOPs, policies, training)
-- =====================================================================

create type public.knowledge_category as enum (
  'sop', 'policy', 'process', 'training', 'onboarding', 'general'
);

create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category public.knowledge_category not null default 'general',
  title text not null,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  tags text[] not null default '{}',
  is_published boolean not null default false,
  view_count int not null default 0,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_company on public.knowledge_articles (company_id, category);
create index idx_knowledge_title_trgm on public.knowledge_articles using gin (title gin_trgm_ops);
create index idx_knowledge_tags on public.knowledge_articles using gin (tags);
create index idx_knowledge_search on public.knowledge_articles
  using gin (to_tsvector('english', title || ' ' || coalesce(content->>'text', '')));

create trigger trg_knowledge_updated_at
  before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

alter table public.knowledge_articles enable row level security;

create policy "members view published articles, authors view drafts"
  on public.knowledge_articles for select
  using (public.is_company_member(company_id) and (is_published or created_by = auth.uid() or public.has_min_role(company_id, 'manager')));

create policy "managers+ create articles"
  on public.knowledge_articles for insert
  with check (public.has_min_role(company_id, 'manager') and created_by = auth.uid());

create policy "author or managers+ update articles"
  on public.knowledge_articles for update
  using (created_by = auth.uid() or public.has_min_role(company_id, 'manager'));

create policy "author or admins delete articles"
  on public.knowledge_articles for delete
  using (created_by = auth.uid() or public.has_min_role(company_id, 'admin'));
