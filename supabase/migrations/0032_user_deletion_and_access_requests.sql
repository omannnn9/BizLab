-- =====================================================================
-- BizLab — 0032: Support fully deleting a user account, plus a public
-- "request access" flow platform admins can approve/deny.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Part 1: make user deletion actually possible.
--
-- profiles.id references auth.users(id) on delete cascade, so deleting
-- the auth.users row already cascades to profiles. But ~35 other
-- columns across the schema reference profiles(id) with the default
-- ON DELETE NO ACTION (author/creator/uploader/reviewer attribution on
-- tasks, projects, files, chat messages, audit logs, etc.) — deleting
-- any user who has ever created or touched anything (i.e. every real
-- user) would fail outright with a foreign-key violation.
--
-- Fix: convert all of these to ON DELETE SET NULL. The row/content
-- survives (a task, a chat message, a file keeps existing for everyone
-- else); only the "who" attribution is cleared — the app already
-- renders these defensively (e.g. message.author?.full_name ?? ...),
-- so a null author reads as unattributed rather than crashing.
-- audit_logs/activity_logs.actor_id are included deliberately: deleting
-- a user must not let them erase the compliance trail of what they did
-- — the log entry survives, only the identifying link is cleared.
--
-- company_members.user_id and notifications.recipient_id are already
-- ON DELETE CASCADE and are intentionally left alone — those rows *are*
-- the user's membership/notification, they should disappear with them.
-- dashboards.owner_id is handled separately below (CASCADE, not SET
-- NULL): null owner_id means "shared company dashboard" elsewhere in
-- this schema, so nulling it out on delete would turn a deleted
-- person's *personal* dashboard into everyone's shared one.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('activity_logs', 'actor_id', 'activity_logs_actor_id_fkey'),
      ('ai_interactions', 'actor_id', 'ai_interactions_actor_id_fkey'),
      ('audit_logs', 'actor_id', 'audit_logs_actor_id_fkey'),
      ('chat_channels', 'created_by', 'chat_channels_created_by_fkey'),
      ('chat_messages', 'author_id', 'chat_messages_author_id_fkey'),
      ('companies', 'created_by', 'companies_created_by_fkey'),
      ('company_invitations', 'invited_by', 'company_invitations_invited_by_fkey'),
      ('company_members', 'invited_by', 'company_members_invited_by_fkey'),
      ('crm_accounts', 'created_by', 'crm_accounts_created_by_fkey'),
      ('crm_contacts', 'created_by', 'crm_contacts_created_by_fkey'),
      ('crm_deals', 'created_by', 'crm_deals_created_by_fkey'),
      ('crm_leads', 'created_by', 'crm_leads_created_by_fkey'),
      ('crm_pipelines', 'created_by', 'crm_pipelines_created_by_fkey'),
      ('dashboards', 'created_by', 'dashboards_created_by_fkey'),
      ('document_comments', 'author_id', 'document_comments_author_id_fkey'),
      ('document_permissions', 'granted_by', 'document_permissions_granted_by_fkey'),
      ('document_versions', 'created_by', 'document_versions_created_by_fkey'),
      ('documents', 'created_by', 'documents_created_by_fkey'),
      ('documents', 'updated_by', 'documents_updated_by_fkey'),
      ('file_shares', 'created_by', 'file_shares_created_by_fkey'),
      ('files', 'uploaded_by', 'files_uploaded_by_fkey'),
      ('finance_expenses', 'reviewed_by', 'finance_expenses_reviewed_by_fkey'),
      ('finance_expenses', 'submitted_by', 'finance_expenses_submitted_by_fkey'),
      ('finance_invoices', 'created_by', 'finance_invoices_created_by_fkey'),
      ('finance_revenue_entries', 'created_by', 'finance_revenue_entries_created_by_fkey'),
      ('folder_shares', 'created_by', 'folder_shares_created_by_fkey'),
      ('folders', 'created_by', 'folders_created_by_fkey'),
      ('hr_leave_requests', 'reviewed_by', 'hr_leave_requests_reviewed_by_fkey'),
      ('knowledge_articles', 'created_by', 'knowledge_articles_created_by_fkey'),
      ('knowledge_articles', 'updated_by', 'knowledge_articles_updated_by_fkey'),
      ('notifications', 'actor_id', 'notifications_actor_id_fkey'),
      ('projects', 'created_by', 'projects_created_by_fkey'),
      ('task_attachments', 'uploaded_by', 'task_attachments_uploaded_by_fkey'),
      ('task_comments', 'author_id', 'task_comments_author_id_fkey'),
      ('tasks', 'created_by', 'tasks_created_by_fkey'),
      ('whiteboards', 'created_by', 'whiteboards_created_by_fkey'),
      ('whiteboards', 'updated_by', 'whiteboards_updated_by_fkey')
    ) as t(tbl, col, cons)
  loop
    execute format('alter table public.%I alter column %I drop not null', r.tbl, r.col);
    execute format('alter table public.%I drop constraint %I', r.tbl, r.cons);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
      r.tbl, r.cons, r.col
    );
  end loop;
end $$;

alter table public.dashboards drop constraint dashboards_owner_id_fkey;
alter table public.dashboards
  add constraint dashboards_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;

-- ---------------------------------------------------------------------
-- Part 2: access requests — a public "request an account" flow. Anyone
-- (unauthenticated) can submit one; only a platform admin can see or
-- act on them. Approving one doesn't create the account by itself —
-- the admin still picks a company/role/temp password through the
-- existing account-creation flow (CreateAccountDialog, pre-filled from
-- the request) — this table only tracks the request's own lifecycle.
-- ---------------------------------------------------------------------
create type public.access_request_status as enum ('pending', 'approved', 'denied');

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  full_name text,
  message text,
  status public.access_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one *pending* request per email — resubmitting while already
-- pending just no-ops client-side rather than piling up duplicates;
-- a denied/approved request doesn't block requesting again later.
create unique index access_requests_pending_email_unique
  on public.access_requests (email)
  where status = 'pending';

alter table public.access_requests enable row level security;

create policy "anyone can submit an access request"
  on public.access_requests for insert
  with check (status = 'pending' and reviewed_by is null and reviewed_at is null);

create policy "platform admins view access requests"
  on public.access_requests for select
  using (public.is_platform_admin());

-- No UPDATE/DELETE policy: reviewing a request only happens through
-- admin_review_access_request() below, same shape as audit_logs having
-- no direct INSERT policy and profiles' admin fields being guarded —
-- reviewed_by/reviewed_at must be trustworthy, not client-supplied.

create or replace function public.admin_review_access_request(p_id uuid, p_approved boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can review access requests' using errcode = '42501';
  end if;

  update public.access_requests
  set status = case when p_approved then 'approved' else 'denied' end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_id and status = 'pending';

  if not found then
    raise exception 'This request was already reviewed' using errcode = 'P0002';
  end if;

  perform public.log_audit_event(
    null, case when p_approved then 'admin.access_request_approved' else 'admin.access_request_denied' end,
    'access_request', p_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_review_access_request(uuid, boolean) from public;
grant execute on function public.admin_review_access_request(uuid, boolean) to authenticated;

comment on table public.access_requests is
  'Public "request an account" submissions. Anyone can insert one (RLS: status must be pending, unreviewed); only platform admins can read them or review them (admin_review_access_request), same access-control shape as company_invitations/profiles admin fields elsewhere in this schema.';
