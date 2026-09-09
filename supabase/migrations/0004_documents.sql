-- =====================================================================
-- BizLab — 0004: Documents (collaborative wiki-style editor)
-- =====================================================================

create type public.folder_module as enum ('documents', 'files');
create type public.doc_access_level as enum ('view', 'comment', 'edit', 'full_control');
create type public.doc_visibility as enum ('company', 'restricted');

-- ---------------------------------------------------------------------
-- folders — shared tree structure, scoped per module (documents/files)
-- ---------------------------------------------------------------------
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  module public.folder_module not null,
  parent_folder_id uuid references public.folders (id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_folders_company on public.folders (company_id, module);
create index idx_folders_parent on public.folders (parent_folder_id);

create trigger trg_folders_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  title text not null default 'Untitled',
  icon text,
  cover_image_url text,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  visibility public.doc_visibility not null default 'company',
  default_access_level public.doc_access_level not null default 'edit',
  is_archived boolean not null default false,
  current_version int not null default 1,
  created_by uuid not null references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_company on public.documents (company_id);
create index idx_documents_folder on public.documents (folder_id);
create index idx_documents_title_trgm on public.documents using gin (title gin_trgm_ops);

create trigger trg_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  version_number int not null,
  content jsonb not null,
  title text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table public.document_permissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  access_level public.doc_access_level not null default 'view',
  granted_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (document_id, member_id)
);

create table public.document_comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text not null,
  anchor jsonb,
  mentions uuid[] not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_document_comments_updated_at
  before update on public.document_comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- access helper: effective access level for the current user on a doc
-- ---------------------------------------------------------------------
create or replace function public.document_access_level(p_document_id uuid)
returns public.doc_access_level
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_doc record;
  v_override public.doc_access_level;
  v_role public.company_role;
begin
  select * into v_doc from public.documents where id = p_document_id;
  if v_doc is null then
    return null;
  end if;
  if not public.is_company_member(v_doc.company_id) then
    return null;
  end if;

  select access_level into v_override
  from public.document_permissions dp
  join public.company_members cm on cm.id = dp.member_id
  where dp.document_id = p_document_id and cm.user_id = auth.uid();

  if v_override is not null then
    return v_override;
  end if;

  if v_doc.visibility = 'restricted' then
    return null;
  end if;

  select role into v_role from public.company_members
  where company_id = v_doc.company_id and user_id = auth.uid() and status = 'active';

  if public.role_rank(v_role) >= public.role_rank('manager') then
    return 'full_control';
  end if;

  return v_doc.default_access_level;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_permissions enable row level security;
alter table public.document_comments enable row level security;

create policy "members view folders"
  on public.folders for select
  using (public.is_company_member(company_id));

create policy "employees+ manage folders"
  on public.folders for all
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

create policy "viewers see accessible documents"
  on public.documents for select
  using (public.document_access_level(id) is not null);

create policy "employees+ create documents"
  on public.documents for insert
  with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy "editors update documents"
  on public.documents for update
  using (public.document_access_level(id) in ('edit', 'full_control'));

create policy "full_control deletes documents"
  on public.documents for delete
  using (public.document_access_level(id) = 'full_control');

create policy "viewers see versions"
  on public.document_versions for select
  using (public.document_access_level(document_id) is not null);

create policy "editors create versions"
  on public.document_versions for insert
  with check (public.document_access_level(document_id) in ('edit', 'full_control'));

create policy "full_control manages permissions"
  on public.document_permissions for all
  using (public.document_access_level(document_id) = 'full_control')
  with check (public.document_access_level(document_id) = 'full_control');

create policy "commenters view comments"
  on public.document_comments for select
  using (public.document_access_level(document_id) is not null);

create policy "commenters add comments"
  on public.document_comments for insert
  with check (
    author_id = auth.uid()
    and public.document_access_level(document_id) in ('comment', 'edit', 'full_control')
  );

create policy "authors edit own comments"
  on public.document_comments for update
  using (author_id = auth.uid() or public.document_access_level(document_id) = 'full_control');

create policy "authors or full_control delete comments"
  on public.document_comments for delete
  using (author_id = auth.uid() or public.document_access_level(document_id) = 'full_control');
