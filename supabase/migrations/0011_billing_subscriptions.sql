-- =====================================================================
-- BizLab — 0011: SaaS subscription plans & billing
-- =====================================================================

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete'
);
create type public.billing_interval as enum ('monthly', 'annual');

-- ---------------------------------------------------------------------
-- subscription_plans — global catalog, not tenant-scoped
-- ---------------------------------------------------------------------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- 'free' | 'starter' | 'business' | 'enterprise'
  name text not null,
  description text,
  price_monthly_cents int not null default 0,
  price_annual_cents int not null default 0,
  max_members int, -- null = unlimited
  storage_quota_bytes bigint not null,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  position int not null default 0
);

insert into public.subscription_plans (key, name, description, price_monthly_cents, price_annual_cents, max_members, storage_quota_bytes, features, position) values
  ('free', 'Free', 'Get started with the essentials', 0, 0, 5, 1073741824,
    '{"tasks":true,"documents":true,"chat":true,"whiteboards":false,"knowledge_hub":false,"audit_logs":false,"sso":false,"guest_seats":0}', 0),
  ('starter', 'Starter', 'For small teams getting organized', 1200, 11000, 20, 21474836480,
    '{"tasks":true,"documents":true,"chat":true,"whiteboards":true,"knowledge_hub":true,"audit_logs":false,"sso":false,"guest_seats":5}', 1),
  ('business', 'Business', 'For growing companies that need control', 2900, 27800, 100, 107374182400,
    '{"tasks":true,"documents":true,"chat":true,"whiteboards":true,"knowledge_hub":true,"audit_logs":true,"sso":false,"guest_seats":20}', 2),
  ('enterprise', 'Enterprise', 'Advanced security & unlimited scale', 4900, 47000, null, 1099511627776,
    '{"tasks":true,"documents":true,"chat":true,"whiteboards":true,"knowledge_hub":true,"audit_logs":true,"sso":true,"guest_seats":null}', 3);

-- ---------------------------------------------------------------------
-- company_subscriptions — one active row per company
-- ---------------------------------------------------------------------
create table public.company_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null default 'trialing',
  billing_interval public.billing_interval not null default 'monthly',
  seats int not null default 1,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '14 days'),
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_company_subscriptions_updated_at
  before update on public.company_subscriptions
  for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  stripe_invoice_id text,
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invoices_company on public.invoices (company_id, created_at desc);

-- ---------------------------------------------------------------------
-- auto-provision a trialing Free-tier subscription for every new company
-- ---------------------------------------------------------------------
create or replace function public.seed_company_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_subscriptions (company_id, plan_id, status)
  select new.id, id, 'trialing' from public.subscription_plans where key = 'free';
  return new;
end;
$$;

create trigger trg_seed_company_subscription
  after insert on public.companies
  for each row execute function public.seed_company_subscription();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.subscription_plans enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.invoices enable row level security;

create policy "anyone can view active plans"
  on public.subscription_plans for select
  using (is_active);

create policy "members view their subscription"
  on public.company_subscriptions for select
  using (public.is_company_member(company_id));

create policy "owners manage subscription"
  on public.company_subscriptions for update
  using (public.has_min_role(company_id, 'owner'));

create policy "admins+ view invoices"
  on public.invoices for select
  using (public.has_min_role(company_id, 'admin'));
