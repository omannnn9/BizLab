-- =====================================================================
-- BizLab — 0017: HR (employees, leave, departments) and Finance
-- (expenses, invoices, revenue). Deliberately lighter than the CRM
-- module: real schema + RLS + working CRUD, without approval-workflow
-- automation or accounting-system integration — see docs/ROADMAP.md.
-- =====================================================================

create type public.leave_type as enum ('vacation', 'sick', 'personal', 'other');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.employment_status as enum ('active', 'on_leave', 'terminated');
create type public.expense_status as enum ('pending', 'approved', 'rejected', 'reimbursed');
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

-- ---------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------
create table public.hr_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  lead_member_id uuid references public.company_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_hr_departments_company on public.hr_departments (company_id);

-- ---------------------------------------------------------------------
-- Employees — one row per company_member who has HR data on file.
-- Deliberately 1:1 with company_members (not every member needs to be
-- "on payroll" — e.g. an external Guest reviewer wouldn't have one).
-- ---------------------------------------------------------------------
create table public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null unique references public.company_members (id) on delete cascade,
  employee_number text,
  department_id uuid references public.hr_departments (id) on delete set null,
  manager_employee_id uuid references public.hr_employees (id) on delete set null,
  job_title text,
  employment_type text default 'full_time' check (employment_type in ('full_time', 'part_time', 'contractor', 'intern')),
  status public.employment_status not null default 'active',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hr_employees_company on public.hr_employees (company_id);
create index idx_hr_employees_department on public.hr_employees (department_id);

create trigger trg_hr_employees_updated_at
  before update on public.hr_employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Leave requests
-- ---------------------------------------------------------------------
create table public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  leave_type public.leave_type not null default 'vacation',
  start_date date not null,
  end_date date not null,
  reason text,
  status public.leave_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index idx_hr_leave_requests_company on public.hr_leave_requests (company_id, status);
create index idx_hr_leave_requests_employee on public.hr_leave_requests (employee_id);

-- ---------------------------------------------------------------------
-- Finance: expenses, invoices, revenue
-- ---------------------------------------------------------------------
create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  category text not null,
  description text,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  expense_date date not null default current_date,
  status public.expense_status not null default 'pending',
  submitted_by uuid not null references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_finance_expenses_company on public.finance_expenses (company_id, status);

create table public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  invoice_number text not null,
  client_name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  status public.invoice_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  paid_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (company_id, invoice_number)
);

create index idx_finance_invoices_company on public.finance_invoices (company_id, status);

create table public.finance_revenue_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'usd',
  recognized_date date not null default current_date,
  notes text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index idx_finance_revenue_company on public.finance_revenue_entries (company_id, recognized_date);

-- Tenant-key immutability, same as every other module (0013 pattern)
create trigger trg_hr_departments_immutable_keys before update on public.hr_departments
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_hr_employees_immutable_keys before update on public.hr_employees
  for each row execute function public.forbid_column_update('company_id', 'member_id');
create trigger trg_hr_leave_immutable_keys before update on public.hr_leave_requests
  for each row execute function public.forbid_column_update('company_id', 'employee_id');
create trigger trg_finance_expenses_immutable_keys before update on public.finance_expenses
  for each row execute function public.forbid_column_update('company_id');
create trigger trg_finance_invoices_immutable_keys before update on public.finance_invoices
  for each row execute function public.forbid_column_update('company_id');

-- ---------------------------------------------------------------------
-- RLS
--
-- HR and Finance are the one place BizLab deliberately departs from
-- "every company member sees everything" (docs/PERMISSIONS.md): an
-- employee's own leave/comp/employment data is private to them and to
-- Managers+, not broadcast to the whole company the way a task or
-- document is.
-- ---------------------------------------------------------------------
alter table public.hr_departments enable row level security;
alter table public.hr_employees enable row level security;
alter table public.hr_leave_requests enable row level security;
alter table public.finance_expenses enable row level security;
alter table public.finance_invoices enable row level security;
alter table public.finance_revenue_entries enable row level security;

create policy "members view departments" on public.hr_departments for select
  using (public.is_company_member(company_id));
create policy "managers+ manage departments" on public.hr_departments for all
  using (public.has_min_role(company_id, 'manager')) with check (public.has_min_role(company_id, 'manager'));

create policy "self or managers+ view employee records" on public.hr_employees for select
  using (
    public.has_min_role(company_id, 'manager')
    or member_id = public.member_id_in(company_id)
  );
create policy "managers+ manage employee records" on public.hr_employees for all
  using (public.has_min_role(company_id, 'manager')) with check (public.has_min_role(company_id, 'manager'));

create policy "self or managers+ view leave requests" on public.hr_leave_requests for select
  using (
    public.has_min_role(company_id, 'manager')
    or exists (select 1 from public.hr_employees e where e.id = employee_id and e.member_id = public.member_id_in(company_id))
  );
create policy "self requests own leave" on public.hr_leave_requests for insert
  with check (
    exists (select 1 from public.hr_employees e where e.id = employee_id and e.member_id = public.member_id_in(company_id))
    or public.has_min_role(company_id, 'manager')
  );
-- Explicit WITH CHECK (not the USING-reuse default): the USING clause
-- governs which *existing* pending requests are targetable; without an
-- explicit CHECK the same expression would reapply to the *new* row,
-- and since `status = 'pending'` there would still be true for a
-- manager's own approval, that half is fine — but for the self-service
-- branch it would require the row to *stay* pending, making a
-- self-cancel (which sets status = 'cancelled') fail its own policy.
-- The real property this needs is narrower than "reuse USING" anyway:
-- self can only ever move their own request to 'cancelled', never to
-- 'approved' — self-approval would defeat the entire point of review.
create policy "self cancels own pending request, managers+ review any" on public.hr_leave_requests for update
  using (
    public.has_min_role(company_id, 'manager')
    or (status = 'pending' and exists (select 1 from public.hr_employees e where e.id = employee_id and e.member_id = public.member_id_in(company_id)))
  )
  with check (
    public.has_min_role(company_id, 'manager')
    or (status = 'cancelled' and exists (select 1 from public.hr_employees e where e.id = employee_id and e.member_id = public.member_id_in(company_id)))
  );

create policy "submitter or managers+ view expenses" on public.finance_expenses for select
  using (public.has_min_role(company_id, 'manager') or submitted_by = auth.uid());
create policy "employees+ submit expenses" on public.finance_expenses for insert
  with check (public.is_company_member(company_id) and submitted_by = auth.uid());
create policy "submitter edits own pending, managers+ review any" on public.finance_expenses for update
  using (
    public.has_min_role(company_id, 'manager')
    or (status = 'pending' and submitted_by = auth.uid())
  );

create policy "managers+ view invoices" on public.finance_invoices for select
  using (public.has_min_role(company_id, 'manager'));
create policy "managers+ manage invoices" on public.finance_invoices for all
  using (public.has_min_role(company_id, 'manager')) with check (public.has_min_role(company_id, 'manager'));

create policy "managers+ view revenue" on public.finance_revenue_entries for select
  using (public.has_min_role(company_id, 'manager'));
create policy "managers+ manage revenue" on public.finance_revenue_entries for all
  using (public.has_min_role(company_id, 'manager')) with check (public.has_min_role(company_id, 'manager'));
