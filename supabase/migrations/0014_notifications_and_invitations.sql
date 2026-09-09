-- =====================================================================
-- BizLab — 0014: make notifications/activity feed actually fire, make
-- invitations actually accept, and enforce the storage quota that was
-- previously only ever displayed.
--
-- Audit finding (FUNC-01): nothing in the system — no trigger, no
-- application code — ever inserted a row into `notifications` or
-- `activity_logs`. The bell, the realtime subscription and the
-- Dashboard "Recent activity" widget were all wired correctly but had
-- no data source. This migration is the fix.
--
-- Audit finding (FUNC-02): `company_invitations` rows were created by
-- Settings → Members → Invite, but nothing ever turned an invitation
-- into a company_members row — there was no accept flow at all.
--
-- Audit finding (FUNC-03): `companies.storage_quota_bytes` and the
-- Billing/Dashboard "storage usage" widgets were purely informational;
-- nothing blocked an upload once a workspace was over quota.
--
-- SEC-24 (found alongside FUNC-01): `notifications`' original INSERT
-- policy (`is_company_member(company_id)`) let any company member
-- create a notification for *any* recipient_id in the entire system —
-- not even scoped to their own company — with completely arbitrary
-- title/body/link/type. Nothing used it yet (per FUNC-01), but it was
-- a live spam/phishing vector the moment anything did. Now that
-- create_notification() is the one real way notifications get made,
-- remove direct client INSERT access entirely, the same treatment
-- audit_logs got in 0013 (SEC-20).
-- =====================================================================
drop policy "system inserts notifications" on public.notifications;
-- No INSERT policy remains on notifications: only the SECURITY
-- DEFINER helper below (and the triggers that call it) can create one.

-- ---------------------------------------------------------------------
-- Internal helpers — SECURITY DEFINER, never directly callable by a
-- client (see revoke below). All real INSERTs happen here so every
-- call site produces consistent, non-spoofable rows.
-- ---------------------------------------------------------------------
create or replace function public.create_notification(
  p_company_id uuid,
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_link text,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- never notify someone about their own action
  if p_recipient_id = p_actor_id then
    return;
  end if;
  insert into public.notifications
    (company_id, recipient_id, actor_id, type, title, body, link, entity_type, entity_id)
  values
    (p_company_id, p_recipient_id, p_actor_id, p_type, p_title, p_body, p_link, p_entity_type, p_entity_id);
end;
$$;

create or replace function public.log_activity(
  p_company_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_company_id, p_actor_id, p_action, p_entity_type, p_entity_id, p_metadata);
end;
$$;

revoke all on function public.create_notification(uuid, uuid, uuid, public.notification_type, text, text, text, text, uuid) from public;
revoke all on function public.log_activity(uuid, uuid, text, text, uuid, jsonb) from public;
-- Intentionally no GRANT to authenticated: these are trigger-internal
-- only. Triggers run as the function owner (SECURITY DEFINER) and so
-- can call them regardless; a client calling supabase.rpc(...) on
-- either name will get a permission-denied error.

-- ---------------------------------------------------------------------
-- Tasks: assignment notifications + activity log
-- ---------------------------------------------------------------------
create or replace function public.trg_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_recipient uuid;
  v_actor uuid;
begin
  select t.company_id, t.title into v_task from public.tasks t where t.id = new.task_id;
  select user_id into v_recipient from public.company_members where id = new.member_id;
  v_actor := auth.uid();

  perform public.create_notification(
    v_task.company_id, v_recipient, v_actor, 'task_assigned',
    'You were assigned to a task', v_task.title,
    '/tasks?task=' || new.task_id, 'task', new.task_id
  );
  return new;
end;
$$;

create trigger trg_on_task_assigned
  after insert on public.task_assignees
  for each row execute function public.trg_task_assigned();

create or replace function public.trg_task_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.company_id, new.created_by, 'task.created', 'task', new.id,
      jsonb_build_object('title', new.title));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_activity(new.company_id, auth.uid(), 'task.status_changed', 'task', new.id,
      jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger trg_on_task_activity
  after insert or update on public.tasks
  for each row execute function public.trg_task_activity();

-- ---------------------------------------------------------------------
-- Task comments: notify the task's creator and assignees (not the
-- commenter themselves)
-- ---------------------------------------------------------------------
create or replace function public.trg_task_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
  v_recipient uuid;
begin
  select company_id, title, created_by into v_task from public.tasks where id = new.task_id;

  perform public.create_notification(
    v_task.company_id, v_task.created_by, new.author_id, 'comment_added',
    'New comment on "' || v_task.title || '"', left(new.body, 140),
    '/tasks?task=' || new.task_id, 'task', new.task_id
  );

  for v_recipient in
    select cm.user_id from public.task_assignees ta
    join public.company_members cm on cm.id = ta.member_id
    where ta.task_id = new.task_id and cm.user_id <> v_task.created_by
  loop
    perform public.create_notification(
      v_task.company_id, v_recipient, new.author_id, 'comment_added',
      'New comment on "' || v_task.title || '"', left(new.body, 140),
      '/tasks?task=' || new.task_id, 'task', new.task_id
    );
  end loop;
  return new;
end;
$$;

create trigger trg_on_task_comment
  after insert on public.task_comments
  for each row execute function public.trg_task_comment_notify();

-- ---------------------------------------------------------------------
-- Documents: sharing notification + activity log
-- ---------------------------------------------------------------------
create or replace function public.trg_document_shared_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc record;
  v_recipient uuid;
begin
  select company_id, title into v_doc from public.documents where id = new.document_id;
  select user_id into v_recipient from public.company_members where id = new.member_id;

  perform public.create_notification(
    v_doc.company_id, v_recipient, new.granted_by, 'document_shared',
    'A document was shared with you', v_doc.title,
    '/documents/' || new.document_id, 'document', new.document_id
  );
  return new;
end;
$$;

create trigger trg_on_document_shared
  after insert on public.document_permissions
  for each row execute function public.trg_document_shared_notify();

create or replace function public.trg_document_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.company_id, new.created_by, 'document.created', 'document', new.id,
      jsonb_build_object('title', new.title));
  end if;
  return new;
end;
$$;

create trigger trg_on_document_activity
  after insert on public.documents
  for each row execute function public.trg_document_activity();

-- ---------------------------------------------------------------------
-- Projects & member joins: activity log only (no single obvious
-- recipient to notify)
-- ---------------------------------------------------------------------
create or replace function public.trg_project_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_activity(new.company_id, new.created_by, 'project.created', 'project', new.id,
    jsonb_build_object('name', new.name));
  return new;
end;
$$;

create trigger trg_on_project_activity
  after insert on public.projects
  for each row execute function public.trg_project_activity();

create or replace function public.trg_member_joined_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform public.log_activity(new.company_id, new.user_id, 'member.joined', 'company_member', new.id, '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger trg_on_member_joined
  after insert or update on public.company_members
  for each row execute function public.trg_member_joined_activity();

-- =====================================================================
-- Invitation acceptance — the missing link between company_invitations
-- and company_members. SECURITY DEFINER because the invitee isn't a
-- member yet, so the normal company_members INSERT policy (admin-only,
-- plus the single-bootstrap-owner case) would otherwise block them.
-- =====================================================================
create or replace function public.accept_company_invitation(p_token uuid)
returns public.company_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.company_invitations;
  v_member public.company_members;
  v_email citext;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from public.company_invitations
  where token = p_token and status = 'pending'
  for update;

  if v_invite is null then
    raise exception 'This invitation is invalid or has already been used' using errcode = 'P0002';
  end if;

  if v_invite.expires_at < now() then
    update public.company_invitations set status = 'expired' where id = v_invite.id;
    raise exception 'This invitation has expired' using errcode = 'P0002';
  end if;

  if v_invite.email <> v_email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.company_members (company_id, user_id, role, status, invited_by, joined_at)
  values (v_invite.company_id, auth.uid(), v_invite.role, 'active', v_invite.invited_by, now())
  on conflict (company_id, user_id) do update set status = 'active', joined_at = now()
  returning * into v_member;

  update public.company_invitations set status = 'accepted' where id = v_invite.id;

  perform public.create_notification(
    v_invite.company_id, v_invite.invited_by, auth.uid(), 'member_joined',
    'Your invitation was accepted', null, '/settings/members', 'company_member', v_member.id
  );

  return v_member;
end;
$$;

revoke all on function public.accept_company_invitation(uuid) from public;
grant execute on function public.accept_company_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Storage quota enforcement — previously display-only.
-- ---------------------------------------------------------------------
create or replace function public.check_storage_quota()
returns trigger
language plpgsql
as $$
declare
  v_used bigint;
  v_quota bigint;
begin
  select coalesce(used_bytes, 0) into v_used from public.company_storage_usage where company_id = new.company_id;
  select storage_quota_bytes into v_quota from public.companies where id = new.company_id;

  if coalesce(v_used, 0) + new.file_size > v_quota then
    raise exception 'Storage quota exceeded'
      using errcode = '23514',
            detail = format('used=%s quota=%s incoming=%s', v_used, v_quota, new.file_size),
            hint = 'Delete unused files or upgrade the workspace plan to increase the storage quota.';
  end if;
  return new;
end;
$$;

create trigger trg_files_check_quota
  before insert on public.files
  for each row execute function public.check_storage_quota();
