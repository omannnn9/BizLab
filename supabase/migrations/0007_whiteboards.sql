-- =====================================================================
-- BizLab — 0007: Whiteboards (infinite canvas collaboration)
-- =====================================================================

create table public.whiteboards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null default 'Untitled board',
  thumbnail_url text,
  -- Canvas is stored as a single JSON document: { elements: [...], appState: {...} }
  -- Elements: sticky notes, shapes, connectors, mind-map nodes, text, images —
  -- each with {id, type, x, y, width, height, rotation, style, data, zIndex}.
  -- Kept as one JSONB blob (rather than one row per element) since whiteboards
  -- are read/written wholesale on open/save; realtime deltas are broadcast
  -- via Supabase Realtime channels, not persisted per-keystroke.
  canvas_data jsonb not null default '{"elements":[],"appState":{}}'::jsonb,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_whiteboards_company on public.whiteboards (company_id);

create trigger trg_whiteboards_updated_at
  before update on public.whiteboards
  for each row execute function public.set_updated_at();

create table public.whiteboard_collaborators (
  whiteboard_id uuid not null references public.whiteboards (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  access_level public.doc_access_level not null default 'edit',
  added_at timestamptz not null default now(),
  primary key (whiteboard_id, member_id)
);

alter table public.whiteboards enable row level security;
alter table public.whiteboard_collaborators enable row level security;

create policy "members view company whiteboards"
  on public.whiteboards for select
  using (public.is_company_member(company_id));

create policy "employees+ create whiteboards"
  on public.whiteboards for insert
  with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy "members update whiteboards"
  on public.whiteboards for update
  using (public.is_company_member(company_id));

create policy "creator or managers delete whiteboards"
  on public.whiteboards for delete
  using (created_by = auth.uid() or public.has_min_role(company_id, 'manager'));

create policy "members view collaborators"
  on public.whiteboard_collaborators for select
  using (exists (select 1 from public.whiteboards w where w.id = whiteboard_id and public.is_company_member(w.company_id)));

create policy "members manage collaborators"
  on public.whiteboard_collaborators for all
  using (exists (select 1 from public.whiteboards w where w.id = whiteboard_id and public.is_company_member(w.company_id)))
  with check (exists (select 1 from public.whiteboards w where w.id = whiteboard_id and public.is_company_member(w.company_id)));
