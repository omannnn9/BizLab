-- =====================================================================
-- Files/Folders access control: "control who has access to them",
-- Google-Drive style — a file or folder defaults to visible to the
-- whole company (today's behavior, unchanged), or can be switched to
-- Restricted, in which case only the uploader/creator, manager+, and
-- people explicitly granted access can see it. Sharing a folder grants
-- access to everything inside it; a file inside a visible folder can
-- still be independently restricted further.
--
-- file_shares already existed (scaffolded, never wired into RLS or the
-- app — 0 rows in production). folder_shares is new, mirroring it.
-- =====================================================================

create type public.item_visibility as enum ('company', 'restricted');

alter table public.folders add column visibility public.item_visibility not null default 'company';
alter table public.files add column visibility public.item_visibility not null default 'company';

create table public.folder_shares (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders(id) on delete cascade,
  member_id uuid not null references public.company_members(id) on delete cascade,
  access_level public.file_access_level not null default 'view',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (folder_id, member_id)
);

alter table public.folder_shares enable row level security;

-- file_shares had no uniqueness guard on (file_id, member_id) — add one
-- now that it's about to be used for real (NULLs, the share_token rows,
-- are unaffected: Postgres treats them as distinct for uniqueness).
alter table public.file_shares add constraint file_shares_file_member_unique unique (file_id, member_id);

-- ---------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER, mirroring is_company_member/
-- has_min_role's existing pattern so RLS on folders/files can call them
-- without recursing back through RLS on their own lookups).
-- ---------------------------------------------------------------------

create or replace function public.has_folder_access(p_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.folders f
    where f.id = p_folder_id
      and public.is_company_member(f.company_id)
      and (
        f.visibility = 'company'
        or f.created_by = auth.uid()
        or public.has_min_role(f.company_id, 'manager')
        or exists (
          select 1 from public.folder_shares fs
          join public.company_members cm on cm.id = fs.member_id
          where fs.folder_id = f.id and cm.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.has_file_access(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.files fl
    where fl.id = p_file_id
      and public.is_company_member(fl.company_id)
      and (
        fl.visibility = 'company'
        or fl.uploaded_by = auth.uid()
        or public.has_min_role(fl.company_id, 'manager')
        or exists (
          select 1 from public.file_shares fsh
          join public.company_members cm on cm.id = fsh.member_id
          where fsh.file_id = fl.id and cm.user_id = auth.uid()
        )
        or (fl.folder_id is not null and public.has_folder_access(fl.folder_id))
      )
  );
$$;

create or replace function public.has_file_edit_access(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.files fl
    where fl.id = p_file_id
      and public.is_company_member(fl.company_id)
      and (
        fl.visibility = 'company'
        or fl.uploaded_by = auth.uid()
        or public.has_min_role(fl.company_id, 'manager')
        or exists (
          select 1 from public.file_shares fsh
          join public.company_members cm on cm.id = fsh.member_id
          where fsh.file_id = fl.id and cm.user_id = auth.uid() and fsh.access_level = 'edit'
        )
        or (fl.folder_id is not null and exists (
          select 1 from public.folder_shares fs
          join public.company_members cm on cm.id = fs.member_id
          where fs.folder_id = fl.folder_id and cm.user_id = auth.uid() and fs.access_level = 'edit'
        ))
      )
  );
$$;

revoke all on function public.has_folder_access(uuid) from public;
revoke all on function public.has_file_access(uuid) from public;
revoke all on function public.has_file_edit_access(uuid) from public;
grant execute on function public.has_folder_access(uuid) to authenticated;
grant execute on function public.has_file_access(uuid) to authenticated;
grant execute on function public.has_file_edit_access(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- folders: SELECT/UPDATE/DELETE now also gate on visibility+shares,
-- not just company membership / a bare role check.
-- ---------------------------------------------------------------------

drop policy "members view folders" on public.folders;
create policy "members view accessible folders" on public.folders
  for select
  using (public.has_folder_access(id));

drop policy "employees+ rename folders" on public.folders;
create policy "employees+ rename accessible folders" on public.folders
  for update
  using (public.has_folder_access(id) and public.has_min_role(company_id, 'employee'));

drop policy "managers+ delete folders" on public.folders;
create policy "managers+ delete accessible folders" on public.folders
  for delete
  using (public.has_folder_access(id) and public.has_min_role(company_id, 'manager'));

-- ---------------------------------------------------------------------
-- files: SELECT gates on visibility+shares; UPDATE additionally
-- requires edit rights (uploader/manager+/explicit edit-level share).
-- DELETE is untouched (already uploader-or-manager+ from 0013/this
-- session's own file-delete-authorization fix).
-- ---------------------------------------------------------------------

drop policy "members view company files" on public.files;
create policy "members view accessible files" on public.files
  for select
  using (public.has_file_access(id));

drop policy "members update company files" on public.files;
create policy "editors update accessible files" on public.files
  for update
  using (public.has_file_edit_access(id));

-- ---------------------------------------------------------------------
-- file_shares: tighten who can grant access (was any company member
-- who could see the file — too loose now that this table actually
-- controls access) and scope visibility of share rows themselves to
-- people who can already see the file, not just anyone in the company.
-- ---------------------------------------------------------------------

drop policy "members share files they can see" on public.file_shares;
create policy "uploader or managers share files" on public.file_shares
  for insert
  with check (
    exists (
      select 1 from public.files f
      where f.id = file_shares.file_id
        and (f.uploaded_by = auth.uid() or public.has_min_role(f.company_id, 'manager'))
    )
  );

drop policy "members view shares on visible files" on public.file_shares;
create policy "members view shares on accessible files" on public.file_shares
  for select
  using (public.has_file_access(file_id));

-- "sharer or managers revoke shares" (DELETE) is unchanged — already
-- correctly scoped to the share's own creator or a manager+.

create policy "creator or managers share folders" on public.folder_shares
  for insert
  with check (
    exists (
      select 1 from public.folders f
      where f.id = folder_shares.folder_id
        and (f.created_by = auth.uid() or public.has_min_role(f.company_id, 'manager'))
    )
  );

create policy "members view shares on accessible folders" on public.folder_shares
  for select
  using (public.has_folder_access(folder_id));

create policy "sharer or managers revoke folder shares" on public.folder_shares
  for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.folders f
      where f.id = folder_shares.folder_id and public.has_min_role(f.company_id, 'manager')
    )
  );

-- ---------------------------------------------------------------------
-- Whoever can manage access (uploader/creator or manager+) should also
-- be able to flip visibility itself — folded into the same UPDATE
-- policies above (visibility is just another column on files/folders),
-- no separate policy needed.
-- ---------------------------------------------------------------------
