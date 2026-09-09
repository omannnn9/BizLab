-- =====================================================================
-- BizLab — 0013: Security hardening, tenant-pivot fixes, notification
-- and activity-log generation.
--
-- Every fix here closes a concrete finding from docs/AUDIT_REPORT.md.
-- Comments reference the finding ID (SEC-xx) so the two documents stay
-- traceable to each other.
-- =====================================================================

-- =====================================================================
-- SEC-01 .. SEC-11 — tenant/parent keys must be immutable.
--
-- Root cause: an UPDATE policy written as `USING (is_company_member
-- (company_id))` (or `uploaded_by = auth.uid()`, `author_id = auth.uid()`,
-- etc.) with no explicit WITH CHECK does NOT, in general, stop the row's
-- company_id / parent-id foreign key from being changed to a DIFFERENT
-- company or parent the same policy would also accept — because the
-- disjunct that makes the check pass (e.g. "you're the uploader") has
-- nothing to do with the target value. Confirmed concretely exploitable
-- on `files` (SEC-04): the uploader clause alone lets any uploader move
-- their own file's `company_id` to another company they belong to,
-- without the manager clause ever being consulted.
--
-- Fix: make the key column immutable via trigger — the correct, simple,
-- audit-proof fix, rather than trying to re-derive "unchanged" inside an
-- RLS expression (which has no access to the OLD row from the WITH CHECK
-- clause).
-- =====================================================================
create or replace function public.forbid_column_update()
returns trigger
language plpgsql
as $$
declare
  col text;
  old_val text;
  new_val text;
begin
  foreach col in array tg_argv loop
    execute format('select ($1).%I::text', col) into old_val using old;
    execute format('select ($1).%I::text', col) into new_val using new;
    if old_val is distinct from new_val then
      raise exception 'Changing column "%" on % is not permitted (id=%)', col, tg_table_name, old.id
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end loop;
  return new;
end;
$$;

comment on function public.forbid_column_update() is
  'Generic BEFORE UPDATE trigger: blocks mutation of the columns named in tg_argv. Used to make company_id / parent-id foreign keys immutable so no RLS policy can be pivoted into moving a row across tenants (SEC-01..SEC-11).';

-- company_id is immutable on every tenant-scoped table
create trigger trg_tasks_immutable_keys before update on public.tasks
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_projects_immutable_keys before update on public.projects
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_documents_immutable_keys before update on public.documents
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_folders_immutable_keys before update on public.folders
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_files_immutable_keys before update on public.files
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_chat_channels_immutable_keys before update on public.chat_channels
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_whiteboards_immutable_keys before update on public.whiteboards
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_dashboards_immutable_keys before update on public.dashboards
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_knowledge_immutable_keys before update on public.knowledge_articles
  for each row execute function public.forbid_column_update('company_id');
-- notifications gets a stricter, dedicated trigger below (SEC-18) that
-- also covers company_id/recipient_id immutability, so no separate
-- trigger is added here.
create trigger trg_activity_logs_immutable_keys before update on public.activity_logs
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_subscriptions_immutable_keys before update on public.company_subscriptions
  for each row execute function public.forbid_column_update('company_id');

-- parent-entity FKs on child rows: comments/attachments/messages must
-- never be re-parented onto a different task/document/channel — the
-- owning-user UPDATE policies (author_id = auth.uid(), etc.) never
-- validated the new parent at all (SEC-06, SEC-08, SEC-09).
create trigger trg_task_comments_immutable_keys before update on public.task_comments
  for each row execute function public.forbid_column_update('task_id');
create trigger trg_task_attachments_immutable_keys before update on public.task_attachments
  for each row execute function public.forbid_column_update('task_id');
create trigger trg_document_comments_immutable_keys before update on public.document_comments
  for each row execute function public.forbid_column_update('document_id');
create trigger trg_chat_messages_immutable_keys before update on public.chat_messages
  for each row execute function public.forbid_column_update('channel_id', 'author_id');
create trigger trg_milestones_immutable_keys before update on public.milestones
  for each row execute function public.forbid_column_update('project_id');

-- =====================================================================
-- SEC-12 (CRITICAL) — private/group chat channels were joinable by any
-- company member, because the chat_channel_members INSERT policy never
-- checked the channel's type. Anyone who learned a private channel's id
-- (a leaked link, a notification, log output — not just brute force)
-- could self-insert and read it. Fix: self-join only for public
-- channels; adding *someone else* requires being a channel owner or a
-- company manager+.
-- =====================================================================
drop policy "members join public channels or are added" on public.chat_channel_members;

create policy "self-join public channels"
  on public.chat_channel_members for insert
  with check (
    member_id = public.member_id_in((select company_id from public.chat_channels where id = channel_id))
    and exists (select 1 from public.chat_channels c where c.id = channel_id and c.type = 'public')
  );

-- `chat_channel_members` cannot be queried from within its own policy
-- via a plain subquery — Postgres has no well-defined way to resolve
-- "is this new row insertable" against "what does the SELECT policy
-- allow" when both point at the same relation, and reports it as
-- infinite recursion. The fix used everywhere else in this schema
-- (is_company_member, is_channel_member, member_id_in, ...) applies
-- here too: put the self-referential check behind a SECURITY DEFINER
-- function, which queries the table as its owner and so bypasses RLS
-- entirely for that one lookup, breaking the cycle.
create or replace function public.is_channel_owner(p_channel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.chat_channel_members ccm
    join public.chat_channels c on c.id = ccm.channel_id
    where ccm.channel_id = p_channel_id
      and ccm.member_id = public.member_id_in(c.company_id)
      and ccm.channel_role = 'owner'
  );
$$;

create policy "owners and managers add members to any channel"
  on public.chat_channel_members for insert
  with check (
    exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and (public.has_min_role(c.company_id, 'manager') or public.is_channel_owner(c.id))
    )
  );

create policy "owners and managers remove members"
  on public.chat_channel_members for delete
  using (
    member_id = public.member_id_in((select company_id from public.chat_channels where id = channel_id))
    or exists (
      select 1 from public.chat_channels c
      where c.id = channel_id and public.has_min_role(c.company_id, 'manager')
    )
  );

-- SEC-13 — any channel member (not just its owner) could rename,
-- archive, or flip a private channel to public. Restrict channel
-- updates to the channel's own owner(s) or a company manager+.
drop policy "owners or managers update channels" on public.chat_channels;

create policy "channel owners and managers update channels"
  on public.chat_channels for update
  using (public.has_min_role(company_id, 'manager') or public.is_channel_owner(id));

-- =====================================================================
-- SEC-14 — permission_overrides.company_id was a free-standing column
-- with no check that it actually matched member_id's real company,
-- letting an Admin of Company A attach override rows to a member of
-- Company B (their own admin check only validates *their* company_id).
-- =====================================================================
create or replace function public.check_permission_override_company()
returns trigger
language plpgsql
as $$
begin
  if new.company_id <> (select company_id from public.company_members where id = new.member_id) then
    raise exception 'permission_overrides.company_id must match member_id''s company' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_permission_overrides_company_check
  before insert or update on public.permission_overrides
  for each row execute function public.check_permission_override_company();

-- =====================================================================
-- SEC-15 — folders were fully manageable (create/rename/delete) by any
-- company member including Guests, contradicting the stated permission
-- model (Employee+ create, Manager+ destructive changes — see
-- docs/PERMISSIONS.md). Split the blanket ALL policy.
-- =====================================================================
drop policy "employees+ manage folders" on public.folders;

create policy "employees+ create folders"
  on public.folders for insert
  with check (public.has_min_role(company_id, 'employee') and created_by = auth.uid());

create policy "employees+ rename folders"
  on public.folders for update
  using (public.has_min_role(company_id, 'employee'));

create policy "managers+ delete folders"
  on public.folders for delete
  using (public.has_min_role(company_id, 'manager'));

-- =====================================================================
-- SEC-16 — whiteboards were editable by Guests, contradicting "Guest =
-- restricted, no default create/edit rights" (docs/PERMISSIONS.md).
-- =====================================================================
drop policy "members update whiteboards" on public.whiteboards;

create policy "employees+ update whiteboards"
  on public.whiteboards for update
  using (public.has_min_role(company_id, 'employee'));

-- =====================================================================
-- SEC-17 — a Manager could edit widgets on another member's *personal*
-- dashboard (owner_id set). Manager override should only apply to
-- shared/company dashboards (owner_id is null).
-- =====================================================================
drop policy "members manage widgets on their dashboards" on public.dashboard_widgets;

create policy "owner manages personal widgets, managers manage shared widgets"
  on public.dashboard_widgets for all
  using (exists (
    select 1 from public.dashboards d where d.id = dashboard_id
    and (d.owner_id = auth.uid() or (d.owner_id is null and public.has_min_role(d.company_id, 'manager')))
  ))
  with check (exists (
    select 1 from public.dashboards d where d.id = dashboard_id
    and (d.owner_id = auth.uid() or (d.owner_id is null and public.has_min_role(d.company_id, 'manager')))
  ));

-- =====================================================================
-- SEC-18 — notifications: a recipient could rewrite their own
-- notification's title/body/link/type/actor_id to fabricate content.
-- Only is_read/read_at should ever change after creation.
-- =====================================================================
-- Trigger functions cannot declare formal parameters (Postgres requires
-- TG_ARGV instead) — the allow-list is passed via CREATE TRIGGER's
-- argument list, same convention as forbid_column_update() above.
create or replace function public.forbid_columns_except()
returns trigger
language plpgsql
as $$
declare
  col text;
  old_val text;
  new_val text;
begin
  for col in select jsonb_object_keys(to_jsonb(old)) loop
    if col = any(tg_argv) then
      continue;
    end if;
    execute format('select ($1).%I::text', col) into old_val using old;
    execute format('select ($1).%I::text', col) into new_val using new;
    if old_val is distinct from new_val then
      raise exception 'Changing column "%" on % is not permitted', col, tg_table_name
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_notifications_restrict_update
  before update on public.notifications
  for each row execute function public.forbid_columns_except('is_read', 'read_at');

-- =====================================================================
-- SEC-19 — activity_logs accepted arbitrary action/entity_type/
-- entity_id/metadata text from any company member with actor_id left
-- NULL, so anyone could plant fake entries in the company activity
-- feed. Require the real actor and constrain entity_type to the known
-- vocabulary.
-- =====================================================================
drop policy "members log activity" on public.activity_logs;

alter table public.activity_logs
  add constraint activity_logs_entity_type_check
  check (entity_type in (
    'task', 'project', 'milestone', 'document', 'file', 'whiteboard',
    'knowledge_article', 'chat_channel', 'company_member'
  ));

create policy "members log their own activity"
  on public.activity_logs for insert
  with check (public.is_company_member(company_id) and actor_id = auth.uid());

-- =====================================================================
-- SEC-20 (CRITICAL) — audit_logs accepted arbitrary client INSERTs
-- (actor_id = auth.uid() OR NULL, everything else free-form), which
-- defeats the entire point of a tamper-evident security trail: any
-- authenticated user could forge "member.role_changed" or "auth.login"
-- entries. Remove direct table access entirely; all writes now go
-- through log_audit_event(), which pins actor_id/company_id to values
-- the caller cannot spoof.
-- =====================================================================
drop policy "members write audit logs for their own actions" on public.audit_logs;
-- No INSERT policy remains on audit_logs at all: direct client inserts
-- are now default-denied by RLS. Only SECURITY DEFINER functions
-- (which bypass RLS as the table owner) can write to it.

create or replace function public.log_audit_event(
  p_company_id uuid,
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_company_id is not null and not public.is_company_member(p_company_id) then
    raise exception 'Not a member of this company' using errcode = '42501';
  end if;

  insert into public.audit_logs (company_id, actor_id, action, target_type, target_id, metadata)
  values (p_company_id, auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

revoke all on function public.log_audit_event(uuid, text, text, uuid, jsonb) from public;
grant execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) to authenticated;

comment on function public.log_audit_event(uuid, text, text, uuid, jsonb) is
  'The only way to write to audit_logs. actor_id and the company membership check are enforced server-side and cannot be spoofed by the caller; action/target/metadata are an application-code contract, same as any audit log design (SEC-20).';

-- =====================================================================
-- SEC-21 — global_search() relied entirely on every unioned table's own
-- RLS to filter out non-members (which does work today) rather than
-- also asserting membership itself. Add an explicit, redundant guard
-- so the function fails safe even if a future branch is added against
-- a table with weaker RLS.
-- =====================================================================
-- PERF-01 / correctness: the original version used similarity()/`%`,
-- which scores over the *whole* string. For realistic short queries
-- against longer titles ("Ship" vs. "Ship the audit fixes") that score
-- (0.24 here) falls below pg_trgm's default 0.3 threshold, so `%`
-- silently excludes the row — global_search returned zero results for
-- exactly the kind of query real users type. Confirmed by direct query
-- during hardening verification. word_similarity()/`<%` scores how well
-- the query matches *some* word-boundary-aligned substring of the
-- target (1.0 for the same example) and is the operator pg_trgm ships
-- specifically for this "short query, long field" case; the existing
-- gin_trgm_ops indexes already support it, no index change needed.
create or replace function public.global_search(p_company_id uuid, p_query text, p_limit int default 30)
returns table (
  result_type public.search_result_type,
  id uuid,
  title text,
  snippet text,
  url_path text,
  rank real
)
language sql
security invoker
stable
set search_path = public
as $$
  with q as (select p_query as raw)
  select 'task'::public.search_result_type, t.id, t.title,
         left(coalesce(t.description, ''), 140),
         '/tasks/' || t.id,
         word_similarity((select raw from q), t.title) as rank
  from public.tasks t, q
  where public.is_company_member(p_company_id) and t.company_id = p_company_id and (select raw from q) <% t.title

  union all
  select 'project', p.id, p.name, left(coalesce(p.description, ''), 140), '/projects/' || p.id,
         word_similarity((select raw from q), p.name)
  from public.projects p, q
  where public.is_company_member(p_company_id) and p.company_id = p_company_id and (select raw from q) <% p.name

  union all
  select 'document', d.id, d.title, '', '/documents/' || d.id,
         word_similarity((select raw from q), d.title)
  from public.documents d, q
  where public.is_company_member(p_company_id) and d.company_id = p_company_id
    and public.document_access_level(d.id) is not null
    and (select raw from q) <% d.title

  union all
  select 'file', f.id, f.name, '', '/files/' || f.id,
         word_similarity((select raw from q), f.name)
  from public.files f, q
  where public.is_company_member(p_company_id) and f.company_id = p_company_id and f.deleted_at is null
    and (select raw from q) <% f.name

  union all
  select 'chat_message', m.id, left(m.body, 60), left(m.body, 140), '/chat/' || m.channel_id || '?message=' || m.id,
         word_similarity((select raw from q), coalesce(m.body, ''))
  from public.chat_messages m
  join public.chat_channels c on c.id = m.channel_id, q
  where public.is_company_member(p_company_id) and c.company_id = p_company_id and m.deleted_at is null
    and public.is_channel_member(m.channel_id)
    and (select raw from q) <% coalesce(m.body, '')

  union all
  select 'knowledge_article', k.id, k.title, left(k.title, 140), '/knowledge/' || k.id,
         word_similarity((select raw from q), k.title)
  from public.knowledge_articles k, q
  where public.is_company_member(p_company_id) and k.company_id = p_company_id and k.is_published
    and (select raw from q) <% k.title

  union all
  select 'user', cm.id, pr.full_name, pr.email, '/people/' || cm.id,
         word_similarity((select raw from q), coalesce(pr.full_name, pr.email))
  from public.company_members cm
  join public.profiles pr on pr.id = cm.user_id, q
  where public.is_company_member(p_company_id) and cm.company_id = p_company_id and cm.status = 'active'
    and ((select raw from q) <% coalesce(pr.full_name, '') or (select raw from q) <% pr.email)

  order by rank desc
  limit p_limit;
$$;

-- =====================================================================
-- SEC-22 — data-integrity constraints that were previously unenforced.
-- =====================================================================

-- Company slugs are used directly as URL path segments; without a
-- format constraint, a direct API insert could set one to something
-- that breaks routing or display. Enforced at the one place every
-- slug is created.
alter table public.companies
  add constraint companies_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

-- Files: cap size (matches the storage bucket limit set below) and
-- pin storage_path to the row's own company_id, so a row can never
-- claim to belong to a different company than the object it points at
-- actually lives under (SEC-04's second half).
alter table public.files
  add constraint files_size_limit check (file_size > 0 and file_size <= 209715200), -- 200 MB
  add constraint files_storage_path_matches_company check (storage_path like company_id::text || '/%');

-- =====================================================================
-- SEC-23 — Storage bucket had no size/type limits at all (any
-- authenticated member of any company could upload arbitrarily large
-- or arbitrarily-typed files). Cap at the platform level too — this is
-- enforced by Storage itself, independent of anything the `files` table
-- believes.
-- =====================================================================
update storage.buckets
set file_size_limit = 209715200, -- 200 MB, matches files_size_limit above
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv', 'text/plain',
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/zip', 'application/json'
    ]
where id = 'company-files';

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'avatars';

-- =====================================================================
-- Performance — missing trigram indexes meant the `project` and `user`
-- branches of global_search() (and any future ILIKE-style search on
-- these columns) fell back to a sequential scan.
-- =====================================================================
create index if not exists idx_projects_name_trgm on public.projects using gin (name gin_trgm_ops);
create index if not exists idx_profiles_full_name_trgm on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists idx_profiles_email_trgm on public.profiles using gin (email gin_trgm_ops);

-- Composite indexes for the dashboard/list queries actually run by the
-- app (see hooks/use-tasks.ts, use-dashboard.ts): filtering by
-- company_id + a secondary predicate, ordered.
create index if not exists idx_tasks_company_project on public.tasks (company_id, project_id) where parent_task_id is null;
create index if not exists idx_documents_company_folder on public.documents (company_id, folder_id) where is_archived = false;
create index if not exists idx_files_company_folder on public.files (company_id, folder_id) where deleted_at is null;
create index if not exists idx_knowledge_company_published on public.knowledge_articles (company_id, is_published);
create index if not exists idx_chat_channel_members_member on public.chat_channel_members (member_id);
