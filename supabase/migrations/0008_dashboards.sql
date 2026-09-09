-- =====================================================================
-- BizLab — 0008: Dashboards & widgets
-- =====================================================================

create type public.widget_type as enum (
  'task_completion',
  'team_productivity',
  'upcoming_deadlines',
  'storage_usage',
  'recent_activity',
  'projects_overview',
  'my_tasks',
  'channel_activity'
);

create table public.dashboards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  owner_id uuid references public.profiles (id), -- null = shared/company dashboard
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_dashboards_company on public.dashboards (company_id);

create trigger trg_dashboards_updated_at
  before update on public.dashboards
  for each row execute function public.set_updated_at();

create table public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  widget_type public.widget_type not null,
  title text,
  config jsonb not null default '{}'::jsonb, -- filters: project_id, date_range, etc.
  layout jsonb not null default '{"x":0,"y":0,"w":4,"h":3}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.dashboards enable row level security;
alter table public.dashboard_widgets enable row level security;

create policy "members view shared dashboards, owners view their own"
  on public.dashboards for select
  using (public.is_company_member(company_id) and (owner_id is null or owner_id = auth.uid()));

create policy "members create dashboards"
  on public.dashboards for insert
  with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy "owner or managers update dashboards"
  on public.dashboards for update
  using (owner_id = auth.uid() or public.has_min_role(company_id, 'manager'));

create policy "owner or managers delete dashboards"
  on public.dashboards for delete
  using ((owner_id = auth.uid() and not is_default) or public.has_min_role(company_id, 'admin'));

create policy "members view widgets on visible dashboards"
  on public.dashboard_widgets for select
  using (exists (
    select 1 from public.dashboards d where d.id = dashboard_id
    and public.is_company_member(d.company_id) and (d.owner_id is null or d.owner_id = auth.uid())
  ));

create policy "members manage widgets on their dashboards"
  on public.dashboard_widgets for all
  using (exists (
    select 1 from public.dashboards d where d.id = dashboard_id
    and (d.owner_id = auth.uid() or public.has_min_role(d.company_id, 'manager'))
  ))
  with check (exists (
    select 1 from public.dashboards d where d.id = dashboard_id
    and (d.owner_id = auth.uid() or public.has_min_role(d.company_id, 'manager'))
  ));
