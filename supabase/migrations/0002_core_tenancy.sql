-- =====================================================================
-- BizLab — 0002: Companies, workspaces, membership & RBAC
-- =====================================================================

create extension if not exists citext;

create type public.company_role as enum ('owner', 'admin', 'manager', 'employee', 'guest');
create type public.member_status as enum ('invited', 'active', 'suspended', 'removed');

-- ---------------------------------------------------------------------
-- companies — one row per tenant / workspace
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  industry text,
  company_size text,
  website text,
  billing_email text,
  security_settings jsonb not null default jsonb_build_object(
    'require_mfa', false,
    'session_timeout_minutes', 10080,
    'allowed_ip_ranges', '[]'::jsonb,
    'sso_enabled', false
  ),
  storage_quota_bytes bigint not null default 5368709120, -- 5 GB default
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- company_members — the tenancy join table; every RLS policy in the
-- system ultimately traces back to a row here.
-- ---------------------------------------------------------------------
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.company_role not null default 'employee',
  status public.member_status not null default 'active',
  title text,
  department text,
  invited_by uuid references public.profiles (id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index idx_company_members_company on public.company_members (company_id);
create index idx_company_members_user on public.company_members (user_id);

create trigger trg_company_members_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- company_invitations — pending invites by email, pre-signup
-- ---------------------------------------------------------------------
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email citext not null,
  role public.company_role not null default 'employee',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  unique (company_id, email)
);

create index idx_company_invitations_token on public.company_invitations (token);

-- ---------------------------------------------------------------------
-- permission_overrides — fine-grained, per-member, per-resource grants
-- that layer on top of the role defaults baked into RESOURCE_PERMISSIONS
-- (see src/lib/permissions.ts). allow=true grants, allow=false revokes.
-- ---------------------------------------------------------------------
create table public.permission_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  resource text not null,
  action text not null,
  allow boolean not null,
  created_at timestamptz not null default now(),
  unique (member_id, resource, action)
);

-- ---------------------------------------------------------------------
-- RBAC helper functions — SECURITY DEFINER so they can read
-- company_members regardless of the caller's own row-level access,
-- then every other table's policy calls these instead of re-deriving
-- membership logic.
-- ---------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.current_role_in(p_company_id uuid)
returns public.company_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.company_members
  where company_id = p_company_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- role rank: owner(5) > admin(4) > manager(3) > employee(2) > guest(1)
create or replace function public.role_rank(p_role public.company_role)
returns int
language sql
immutable
as $$
  select case p_role
    when 'owner' then 5
    when 'admin' then 4
    when 'manager' then 3
    when 'employee' then 2
    when 'guest' then 1
  end;
$$;

create or replace function public.has_min_role(p_company_id uuid, p_min_role public.company_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.role_rank(public.current_role_in(p_company_id)) >= public.role_rank(p_min_role);
$$;

create or replace function public.member_id_in(p_company_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.company_members
  where company_id = p_company_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- RLS: companies
-- ---------------------------------------------------------------------
alter table public.companies enable row level security;

create policy "members can view their companies"
  on public.companies for select
  using (public.is_company_member(id));

create policy "authenticated users can create a company"
  on public.companies for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "owners and admins can update company"
  on public.companies for update
  using (public.has_min_role(id, 'admin'));

create policy "only owners can delete company"
  on public.companies for delete
  using (public.has_min_role(id, 'owner'));

-- ---------------------------------------------------------------------
-- RLS: company_members
-- ---------------------------------------------------------------------
alter table public.company_members enable row level security;

create policy "members can view co-members"
  on public.company_members for select
  using (public.is_company_member(company_id));

create policy "admins manage members, owners created at signup"
  on public.company_members for insert
  with check (
    public.has_min_role(company_id, 'admin')
    or (user_id = auth.uid() and role = 'owner' and not exists (
      select 1 from public.company_members m where m.company_id = company_members.company_id
    ))
  );

create policy "admins update members below their rank"
  on public.company_members for update
  using (
    public.has_min_role(company_id, 'admin')
    and public.role_rank(public.current_role_in(company_id)) >= public.role_rank(role)
  );

create policy "admins remove members below their rank"
  on public.company_members for delete
  using (
    public.has_min_role(company_id, 'admin')
    and public.role_rank(public.current_role_in(company_id)) >= public.role_rank(role)
  );

-- ---------------------------------------------------------------------
-- RLS: company_invitations
-- ---------------------------------------------------------------------
alter table public.company_invitations enable row level security;

create policy "managers+ view invitations"
  on public.company_invitations for select
  using (public.has_min_role(company_id, 'manager'));

create policy "admins create invitations"
  on public.company_invitations for insert
  with check (public.has_min_role(company_id, 'admin') and invited_by = auth.uid());

create policy "admins revoke invitations"
  on public.company_invitations for update
  using (public.has_min_role(company_id, 'admin'));

-- ---------------------------------------------------------------------
-- RLS: permission_overrides
-- ---------------------------------------------------------------------
alter table public.permission_overrides enable row level security;

create policy "admins manage permission overrides"
  on public.permission_overrides for all
  using (public.has_min_role(company_id, 'admin'))
  with check (public.has_min_role(company_id, 'admin'));

-- ---------------------------------------------------------------------
-- Now that company_members exists, finish `profiles` policies
-- ---------------------------------------------------------------------
create policy "profiles are viewable by co-members and self"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.company_members me
      join public.company_members them on them.company_id = me.company_id
      where me.user_id = auth.uid() and me.status = 'active'
        and them.user_id = public.profiles.id and them.status = 'active'
    )
  );

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid());
