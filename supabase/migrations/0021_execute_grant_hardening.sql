-- =====================================================================
-- BizLab — 0021: close a real gap found by verifying against a live
-- Supabase project rather than the local test stub: `revoke ... from
-- public` (0013 SEC-20, 0014 SEC-24) does not touch grants Supabase's
-- own default-privileges template gives directly to `anon` and
-- `authenticated` on every new function in `public` — those are
-- separate roles from the `public` pseudo-role, so the original
-- REVOKE statements never actually reached them. Confirmed live:
-- has_function_privilege('anon', 'create_notification', 'EXECUTE')
-- returned true despite the 0014 revoke.
--
-- Functions that RETURN TRIGGER (forbid_column_update, seed_*,
-- trg_*_activity, handle_new_user, check_storage_quota, etc.) are
-- unaffected by this gap: Postgres refuses to invoke a trigger-typed
-- function outside trigger context regardless of EXECUTE grants, so
-- those were never actually callable via RPC. The two below are not
-- trigger functions and were.
-- =====================================================================

-- create_notification / log_activity: purely trigger-internal, called
-- only from other SECURITY DEFINER trigger functions (which run as the
-- function owner and so need no direct grant themselves). Neither
-- validates its caller-supplied company_id/actor_id/recipient_id at
-- all, so leaving them reachable let anon forge arbitrary notifications
-- and activity-feed entries in any company — exactly what SEC-24 and
-- SEC-19 were meant to prevent.
revoke execute on function public.create_notification(
  uuid, uuid, uuid, public.notification_type, text, text, text, text, uuid
) from anon, authenticated;

revoke execute on function public.log_activity(
  uuid, uuid, text, text, uuid, jsonb
) from anon, authenticated;

-- These four already validate the caller correctly via auth.uid()
-- internally (log_audit_event and accept_company_invitation check
-- membership/identity; save_document_version and
-- restore_document_version check document_access_level), so this is
-- hardening to match original intent rather than a live exploit —
-- unauthenticated callers were never able to do anything through them
-- beyond triggering their own "not authenticated"/"not permitted"
-- exceptions. Restricting to `authenticated` closes the gap anyway.
revoke execute on function public.log_audit_event(uuid, text, text, uuid, jsonb) from anon;
revoke execute on function public.accept_company_invitation(uuid) from anon;
revoke execute on function public.save_document_version(uuid, text, jsonb) from anon;
revoke execute on function public.restore_document_version(uuid, int) from anon;

-- =====================================================================
-- company_storage_usage: a plain view over an RLS-protected table
-- (`files`) runs with the view owner's privileges, not the querying
-- user's — Postgres/Supabase's standard "security definer view" trap.
-- Without security_invoker, any authenticated user querying this view
-- got every company's aggregate storage usage, not just their own.
-- security_invoker (PG15+) makes it evaluate files' own RLS as the
-- querying user instead, same as if the view didn't exist.
-- =====================================================================
create or replace view public.company_storage_usage
with (security_invoker = true) as
select
  company_id,
  coalesce(sum(file_size) filter (where deleted_at is null), 0) as used_bytes,
  count(*) filter (where deleted_at is null) as file_count
from public.files
group by company_id;

-- =====================================================================
-- Pin search_path on the handful of functions that were missed when
-- every other SECURITY DEFINER/plpgsql function in 0001-0020 got one —
-- flagged by the Supabase linter as function_search_path_mutable.
-- =====================================================================
alter function public.set_updated_at() set search_path = public;
alter function public.role_rank(public.company_role) set search_path = public;
alter function public.forbid_column_update() set search_path = public;
alter function public.check_permission_override_company() set search_path = public;
alter function public.forbid_columns_except() set search_path = public;
alter function public.check_storage_quota() set search_path = public;
alter function public.convert_crm_lead(uuid, boolean, uuid, uuid, bigint) set search_path = public;
