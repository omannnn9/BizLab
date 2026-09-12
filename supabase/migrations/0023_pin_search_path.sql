-- =====================================================================
-- BizLab — 0023: pin search_path on the one function 0022 missed
-- (flagged by the Supabase linter as function_search_path_mutable).
-- =====================================================================
alter function public.forbid_profile_admin_fields_self_edit() set search_path = public;
