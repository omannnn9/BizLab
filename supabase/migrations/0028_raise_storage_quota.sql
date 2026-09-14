-- =====================================================================
-- BizLab — 0028: Raise the default storage quota well past 5 GB
-- =====================================================================
-- companies.storage_quota_bytes defaulted to 5 GB (0002_core_tenancy.sql)
-- from when this was a plan-gated SaaS product; billing/plan gating was
-- removed entirely in an earlier pass, but the flat 5 GB default was
-- never revisited, and nothing in the app let anyone raise it per
-- company — see the admin_update_company_storage_quota RPC and the
-- Administration → Companies UI added alongside this migration.
--
-- New default: 500 GB. Existing companies are bumped up to at least
-- that (never lowered, in case one was already raised some other way).
-- No RLS change needed: "owners and admins can update company" already
-- lets a platform admin (current_role_in resolves them to 'owner' on
-- every company) update storage_quota_bytes directly — the gap was
-- purely that nothing in the app ever exposed that column to edit.

alter table public.companies
  alter column storage_quota_bytes set default 536870912000; -- 500 GB

update public.companies
  set storage_quota_bytes = 536870912000
  where storage_quota_bytes < 536870912000;
