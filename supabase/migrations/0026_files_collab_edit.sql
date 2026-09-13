-- =====================================================================
-- BizLab — 0026: Any company member can edit shared files
-- =====================================================================
-- 0005_files_storage.sql restricted UPDATE on `files` to the uploader
-- or a manager+, but src/lib/permissions.ts (the client-side mirror)
-- has always said files.edit = employee — i.e. any active member. That
-- mismatch meant a teammate editing a colleague's uploaded Word/Excel
-- doc (a completely ordinary thing to want in a collaboration tool)
-- would hit a silent RLS rejection despite the UI offering no warning.
-- Widen the real policy to match the documented intent; delete stays
-- uploader-or-manager, which is the right place for a stricter bar.

drop policy "uploader or managers update files" on public.files;

create policy "members update company files"
  on public.files for update
  using (public.is_company_member(company_id));
