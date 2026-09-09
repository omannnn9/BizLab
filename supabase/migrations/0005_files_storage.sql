-- =====================================================================
-- BizLab — 0005: File storage, quotas & sharing
-- =====================================================================

create type public.file_access_level as enum ('view', 'edit');

create table public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  name text not null,
  storage_path text not null unique, -- path inside the `company-files` bucket: {company_id}/{uuid}-{name}
  file_size bigint not null,
  mime_type text,
  extension text,
  checksum text,
  version int not null default 1,
  description text,
  uploaded_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_files_company on public.files (company_id);
create index idx_files_folder on public.files (folder_id);
create index idx_files_name_trgm on public.files using gin (name gin_trgm_ops);

create trigger trg_files_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

create table public.file_shares (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  member_id uuid references public.company_members (id) on delete cascade,
  access_level public.file_access_level not null default 'view',
  share_token uuid, -- set when shared via public link
  expires_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (member_id is not null or share_token is not null)
);

create unique index idx_file_shares_token on public.file_shares (share_token) where share_token is not null;

-- ---------------------------------------------------------------------
-- storage usage: computed view + a fast counter kept in `companies`
-- ---------------------------------------------------------------------
create or replace view public.company_storage_usage as
select
  company_id,
  coalesce(sum(file_size) filter (where deleted_at is null), 0) as used_bytes,
  count(*) filter (where deleted_at is null) as file_count
from public.files
group by company_id;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.files enable row level security;
alter table public.file_shares enable row level security;

create policy "members view company files"
  on public.files for select
  using (public.is_company_member(company_id));

create policy "employees+ upload files"
  on public.files for insert
  with check (public.is_company_member(company_id) and uploaded_by = auth.uid());

create policy "uploader or managers update files"
  on public.files for update
  using (uploaded_by = auth.uid() or public.has_min_role(company_id, 'manager'));

create policy "uploader or managers delete files"
  on public.files for delete
  using (uploaded_by = auth.uid() or public.has_min_role(company_id, 'manager'));

create policy "members view shares on visible files"
  on public.file_shares for select
  using (exists (select 1 from public.files f where f.id = file_id and public.is_company_member(f.company_id)));

create policy "members share files they can see"
  on public.file_shares for insert
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.files f where f.id = file_id and public.is_company_member(f.company_id))
  );

create policy "sharer or managers revoke shares"
  on public.file_shares for delete
  using (
    created_by = auth.uid()
    or exists (select 1 from public.files f where f.id = file_id and public.has_min_role(f.company_id, 'manager'))
  );

-- =====================================================================
-- Supabase Storage bucket + object policies
-- Path convention: company-files/{company_id}/{uuid}-{filename}
-- Path prefix segment [1] is validated against company membership.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('company-files', 'company-files', false)
on conflict (id) do nothing;

create policy "members read company-files objects"
  on storage.objects for select
  using (
    bucket_id = 'company-files'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );

create policy "members upload company-files objects"
  on storage.objects for insert
  with check (
    bucket_id = 'company-files'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );

create policy "members delete own company-files objects"
  on storage.objects for delete
  using (
    bucket_id = 'company-files'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "anyone reads avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users manage own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
