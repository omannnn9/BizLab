-- =====================================================================
-- BizLab — 0016: CRM module — leads, accounts (the "Companies" the spec
-- asks for — named crm_accounts to avoid colliding with the tenant
-- `companies` table), contacts, deals and a configurable pipeline.
-- =====================================================================

create type public.crm_lead_status as enum ('new', 'contacted', 'qualified', 'disqualified', 'converted');
create type public.crm_deal_status as enum ('open', 'won', 'lost');

-- ---------------------------------------------------------------------
-- Pipeline: a company can run more than one (e.g. Sales vs. Partnerships)
-- ---------------------------------------------------------------------
create table public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines (id) on delete cascade,
  name text not null,
  position int not null default 0,
  probability_pct int not null default 0 check (probability_pct between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_crm_pipeline_stages_pipeline on public.crm_pipeline_stages (pipeline_id, position);

-- ---------------------------------------------------------------------
-- Accounts — the customer/prospect organizations ("Companies" in the
-- product brief)
-- ---------------------------------------------------------------------
create table public.crm_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  company_size text,
  owner_member_id uuid references public.company_members (id),
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_accounts_company on public.crm_accounts (company_id);
create index idx_crm_accounts_name_trgm on public.crm_accounts using gin (name gin_trgm_ops);

create trigger trg_crm_accounts_updated_at
  before update on public.crm_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Contacts — people, optionally linked to an account
-- ---------------------------------------------------------------------
create table public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  account_id uuid references public.crm_accounts (id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  job_title text,
  owner_member_id uuid references public.company_members (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_contacts_company on public.crm_contacts (company_id);
create index idx_crm_contacts_account on public.crm_contacts (account_id);
create index idx_crm_contacts_name_trgm on public.crm_contacts using gin ((first_name || ' ' || coalesce(last_name, '')) gin_trgm_ops);

create trigger trg_crm_contacts_updated_at
  before update on public.crm_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Leads — unqualified inbound entries, convertible into an
-- account+contact(+deal) via convert_crm_lead() below
-- ---------------------------------------------------------------------
create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company_name text,
  source text,
  status public.crm_lead_status not null default 'new',
  owner_member_id uuid references public.company_members (id),
  notes text,
  converted_account_id uuid references public.crm_accounts (id) on delete set null,
  converted_contact_id uuid references public.crm_contacts (id) on delete set null,
  converted_deal_id uuid,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_leads_company on public.crm_leads (company_id, status);

create trigger trg_crm_leads_updated_at
  before update on public.crm_leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------
create table public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines (id),
  stage_id uuid not null references public.crm_pipeline_stages (id),
  account_id uuid references public.crm_accounts (id) on delete set null,
  contact_id uuid references public.crm_contacts (id) on delete set null,
  name text not null,
  amount_cents bigint not null default 0,
  currency text not null default 'usd',
  status public.crm_deal_status not null default 'open',
  expected_close_date date,
  owner_member_id uuid references public.company_members (id),
  position numeric not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_deals_company on public.crm_deals (company_id);
create index idx_crm_deals_stage on public.crm_deals (stage_id);
create index idx_crm_deals_pipeline on public.crm_deals (pipeline_id);

create trigger trg_crm_deals_updated_at
  before update on public.crm_deals
  for each row execute function public.set_updated_at();

alter table public.crm_leads
  add constraint crm_leads_converted_deal_fkey foreign key (converted_deal_id) references public.crm_deals (id) on delete set null;

-- ---------------------------------------------------------------------
-- Convert a lead into an account + contact (+ optional deal) in one
-- transaction, so a lead never ends up half-converted.
-- ---------------------------------------------------------------------
create or replace function public.convert_crm_lead(
  p_lead_id uuid,
  p_create_deal boolean default true,
  p_pipeline_id uuid default null,
  p_stage_id uuid default null,
  p_deal_amount_cents bigint default 0
)
returns table (account_id uuid, contact_id uuid, deal_id uuid)
language plpgsql
security invoker
as $$
declare
  v_lead public.crm_leads;
  v_account_id uuid;
  v_contact_id uuid;
  v_deal_id uuid;
  v_name_parts text[];
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_lead.company_name is not null then
    insert into public.crm_accounts (company_id, name, created_by)
    values (v_lead.company_id, v_lead.company_name, auth.uid())
    returning id into v_account_id;
  end if;

  v_name_parts := string_to_array(v_lead.name, ' ');
  insert into public.crm_contacts (company_id, account_id, first_name, last_name, email, phone, created_by)
  values (
    v_lead.company_id, v_account_id, v_name_parts[1],
    nullif(array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' '), ''),
    v_lead.email, v_lead.phone, auth.uid()
  )
  returning id into v_contact_id;

  if p_create_deal then
    insert into public.crm_deals (
      company_id, pipeline_id, stage_id, account_id, contact_id, name, amount_cents, created_by
    )
    values (
      v_lead.company_id, p_pipeline_id, p_stage_id, v_account_id, v_contact_id,
      v_lead.name || ' — deal', p_deal_amount_cents, auth.uid()
    )
    returning id into v_deal_id;
  end if;

  update public.crm_leads
  set status = 'converted', converted_account_id = v_account_id,
      converted_contact_id = v_contact_id, converted_deal_id = v_deal_id
  where id = p_lead_id;

  return query select v_account_id, v_contact_id, v_deal_id;
end;
$$;

revoke all on function public.convert_crm_lead(uuid, boolean, uuid, uuid, bigint) from public;
grant execute on function public.convert_crm_lead(uuid, boolean, uuid, uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- Seed a default pipeline for every new company, same pattern as chat
-- channels / dashboard widgets in seed_company_defaults().
-- ---------------------------------------------------------------------
create or replace function public.seed_crm_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
begin
  insert into public.crm_pipelines (company_id, name, is_default, created_by)
  values (new.id, 'Sales Pipeline', true, new.created_by)
  returning id into v_pipeline_id;

  insert into public.crm_pipeline_stages (pipeline_id, name, position, probability_pct, is_won, is_lost)
  values
    (v_pipeline_id, 'New', 0, 10, false, false),
    (v_pipeline_id, 'Qualified', 1, 30, false, false),
    (v_pipeline_id, 'Proposal', 2, 60, false, false),
    (v_pipeline_id, 'Negotiation', 3, 80, false, false),
    (v_pipeline_id, 'Won', 4, 100, true, false),
    (v_pipeline_id, 'Lost', 5, 0, false, true);

  return new;
end;
$$;

create trigger trg_seed_crm_defaults
  after insert on public.companies
  for each row execute function public.seed_crm_defaults();

-- ---------------------------------------------------------------------
-- Tenant/parent-key immutability, same treatment as every other table
-- (0013 SEC-01..11) — applied from the start here rather than retrofitted.
-- ---------------------------------------------------------------------
create trigger trg_crm_accounts_immutable_keys before update on public.crm_accounts
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_crm_contacts_immutable_keys before update on public.crm_contacts
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_crm_leads_immutable_keys before update on public.crm_leads
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_crm_deals_immutable_keys before update on public.crm_deals
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_crm_pipelines_immutable_keys before update on public.crm_pipelines
  for each row execute function public.forbid_column_update('company_id');

-- ---------------------------------------------------------------------
-- RLS — CRM data follows the same "Employee views/creates, Manager+
-- edits/deletes" shape as Projects (docs/PERMISSIONS.md).
-- ---------------------------------------------------------------------
alter table public.crm_pipelines enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_accounts enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_deals enable row level security;

create policy "members view pipelines" on public.crm_pipelines for select
  using (public.is_company_member(company_id));
create policy "managers+ manage pipelines" on public.crm_pipelines for all
  using (public.has_min_role(company_id, 'manager')) with check (public.has_min_role(company_id, 'manager'));

create policy "members view pipeline stages" on public.crm_pipeline_stages for select
  using (exists (select 1 from public.crm_pipelines p where p.id = pipeline_id and public.is_company_member(p.company_id)));
create policy "managers+ manage pipeline stages" on public.crm_pipeline_stages for all
  using (exists (select 1 from public.crm_pipelines p where p.id = pipeline_id and public.has_min_role(p.company_id, 'manager')))
  with check (exists (select 1 from public.crm_pipelines p where p.id = pipeline_id and public.has_min_role(p.company_id, 'manager')));

create policy "members view accounts" on public.crm_accounts for select
  using (public.is_company_member(company_id));
create policy "employees+ create accounts" on public.crm_accounts for insert
  with check (public.has_min_role(company_id, 'employee') and created_by = auth.uid());
create policy "employees+ update accounts" on public.crm_accounts for update
  using (public.has_min_role(company_id, 'employee'));
create policy "managers+ delete accounts" on public.crm_accounts for delete
  using (public.has_min_role(company_id, 'manager'));

create policy "members view contacts" on public.crm_contacts for select
  using (public.is_company_member(company_id));
create policy "employees+ create contacts" on public.crm_contacts for insert
  with check (public.has_min_role(company_id, 'employee') and created_by = auth.uid());
create policy "employees+ update contacts" on public.crm_contacts for update
  using (public.has_min_role(company_id, 'employee'));
create policy "managers+ delete contacts" on public.crm_contacts for delete
  using (public.has_min_role(company_id, 'manager'));

create policy "members view leads" on public.crm_leads for select
  using (public.is_company_member(company_id));
create policy "employees+ create leads" on public.crm_leads for insert
  with check (public.has_min_role(company_id, 'employee') and created_by = auth.uid());
create policy "employees+ update leads" on public.crm_leads for update
  using (public.has_min_role(company_id, 'employee'));
create policy "managers+ delete leads" on public.crm_leads for delete
  using (public.has_min_role(company_id, 'manager'));

create policy "members view deals" on public.crm_deals for select
  using (public.is_company_member(company_id));
create policy "employees+ create deals" on public.crm_deals for insert
  with check (public.has_min_role(company_id, 'employee') and created_by = auth.uid());
create policy "employees+ update deals" on public.crm_deals for update
  using (public.has_min_role(company_id, 'employee'));
create policy "managers+ delete deals" on public.crm_deals for delete
  using (public.has_min_role(company_id, 'manager'));

-- Missing indexes on this pattern were flagged in the audit for other
-- modules (PERF-01) — added here from the start.
create index idx_crm_leads_name_trgm on public.crm_leads using gin (name gin_trgm_ops);
create index idx_crm_deals_name_trgm on public.crm_deals using gin (name gin_trgm_ops);
