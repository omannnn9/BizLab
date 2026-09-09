-- =====================================================================
-- BizLab — 0010: Notifications, activity feed, audit log
-- =====================================================================

create type public.notification_type as enum (
  'task_assigned', 'task_due_soon', 'mentioned', 'document_updated',
  'document_shared', 'file_shared', 'chat_message', 'project_updated',
  'comment_added', 'invitation_received', 'member_joined'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  type public.notification_type not null,
  title text not null,
  body text,
  link text, -- client-side route, e.g. /w/{slug}/tasks/{id}
  entity_type text,
  entity_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications (recipient_id, is_read, created_at desc);

-- ---------------------------------------------------------------------
-- activity_logs — polymorphic product activity feed (dashboards, entity history)
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null, -- e.g. 'task.created', 'document.edited', 'project.status_changed'
  entity_type text not null, -- 'task' | 'project' | 'document' | 'file' | 'whiteboard' | ...
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_activity_logs_company on public.activity_logs (company_id, created_at desc);
create index idx_activity_logs_entity on public.activity_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- audit_logs — security & compliance trail (auth events, permission
-- changes, exports, deletions). Immutable: no update/delete policies.
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  action text not null, -- 'auth.login', 'auth.mfa_enabled', 'member.role_changed', 'permission.overridden', ...
  target_type text,
  target_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_company on public.audit_logs (company_id, created_at desc);
create index idx_audit_logs_actor on public.audit_logs (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.audit_logs enable row level security;

create policy "users view own notifications"
  on public.notifications for select
  using (recipient_id = auth.uid());

create policy "users mark own notifications read"
  on public.notifications for update
  using (recipient_id = auth.uid());

create policy "system inserts notifications"
  on public.notifications for insert
  with check (public.is_company_member(company_id));

create policy "members view company activity"
  on public.activity_logs for select
  using (public.is_company_member(company_id));

create policy "members log activity"
  on public.activity_logs for insert
  with check (public.is_company_member(company_id) and (actor_id = auth.uid() or actor_id is null));

create policy "admins+ view audit logs"
  on public.audit_logs for select
  using (company_id is null or public.has_min_role(company_id, 'admin'));

create policy "members write audit logs for their own actions"
  on public.audit_logs for insert
  with check (actor_id = auth.uid() or actor_id is null);
