-- =====================================================================
-- BizLab — 0003: Projects, milestones, tasks
-- =====================================================================

create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled');
create type public.task_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type public.milestone_status as enum ('upcoming', 'in_progress', 'completed', 'missed');

-- ---------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'planning',
  color text not null default '#6366f1',
  icon text,
  owner_id uuid references public.company_members (id),
  start_date date,
  due_date date,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_company on public.projects (company_id);

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  project_role text not null default 'contributor' check (project_role in ('lead', 'contributor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, member_id)
);

-- ---------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  description text,
  status public.milestone_status not null default 'upcoming',
  due_date date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'none',
  start_date date,
  due_date date,
  completed_at timestamptz,
  recurrence_rule jsonb, -- e.g. {"freq":"weekly","interval":1,"byday":["MO"]}
  position numeric not null default 0, -- fractional index for kanban/list ordering
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_company on public.tasks (company_id);
create index idx_tasks_project on public.tasks (project_id);
create index idx_tasks_status on public.tasks (company_id, status);
create index idx_tasks_due_date on public.tasks (company_id, due_date);
create index idx_tasks_parent on public.tasks (parent_task_id);
create index idx_tasks_title_trgm on public.tasks using gin (title gin_trgm_ops);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (task_id, member_id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint not null,
  mime_type text,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;

create policy "members view company projects"
  on public.projects for select
  using (public.is_company_member(company_id));

create policy "managers+ create projects"
  on public.projects for insert
  with check (public.has_min_role(company_id, 'manager') and created_by = auth.uid());

create policy "managers+ update projects"
  on public.projects for update
  using (public.has_min_role(company_id, 'manager'));

create policy "admins+ delete projects"
  on public.projects for delete
  using (public.has_min_role(company_id, 'admin'));

create policy "members view project members"
  on public.project_members for select
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_company_member(p.company_id)));

create policy "managers+ manage project members"
  on public.project_members for all
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_min_role(p.company_id, 'manager')))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_min_role(p.company_id, 'manager')));

create policy "members view milestones"
  on public.milestones for select
  using (exists (select 1 from public.projects p where p.id = project_id and public.is_company_member(p.company_id)));

create policy "managers+ manage milestones"
  on public.milestones for all
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_min_role(p.company_id, 'manager')))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_min_role(p.company_id, 'manager')));

create policy "members view company tasks"
  on public.tasks for select
  using (public.is_company_member(company_id));

create policy "employees+ create tasks"
  on public.tasks for insert
  with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy "employees+ update tasks"
  on public.tasks for update
  using (public.is_company_member(company_id));

create policy "managers+ or creator delete tasks"
  on public.tasks for delete
  using (public.has_min_role(company_id, 'manager') or created_by = auth.uid());

create policy "members view assignees"
  on public.task_assignees for select
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));

create policy "members manage assignees"
  on public.task_assignees for all
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)))
  with check (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));

create policy "members view comments"
  on public.task_comments for select
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));

create policy "members add comments"
  on public.task_comments for insert
  with check (author_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));

create policy "authors edit own comments"
  on public.task_comments for update
  using (author_id = auth.uid());

create policy "authors or managers delete comments"
  on public.task_comments for delete
  using (
    author_id = auth.uid()
    or exists (select 1 from public.tasks t where t.id = task_id and public.has_min_role(t.company_id, 'manager'))
  );

create policy "members view attachments"
  on public.task_attachments for select
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));

create policy "members add attachments"
  on public.task_attachments for insert
  with check (uploaded_by = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and public.is_company_member(t.company_id)));

create policy "uploader or managers delete attachments"
  on public.task_attachments for delete
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.tasks t where t.id = task_id and public.has_min_role(t.company_id, 'manager'))
  );
