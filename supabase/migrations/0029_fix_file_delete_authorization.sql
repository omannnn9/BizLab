-- =====================================================================
-- Fix a real data-loss hole found during a full-app audit: the storage
-- DELETE policy on the company-files bucket only checked company
-- membership, with no role or ownership check at all — while the
-- `files` table's own DELETE policy correctly required the uploader
-- or a manager+. Any company member (including a guest) could:
--   1. call storage.remove() directly (allowed by the loose storage
--      policy) — permanently destroying the file's bytes, then
--   2. have the `files` row DELETE silently no-op under RLS (Postgres/
--      PostgREST does not error when RLS filters a DELETE to zero
--      matched rows — it returns success with an empty result)
-- leaving a `files` row that still lists the upload but whose content
-- is gone forever, with no error surfaced anywhere. The app-level fix
-- (reordering the delete and checking the affected-row count) ships
-- alongside this migration in use-files.ts; this migration is the
-- actual security fix, since the RLS policy is the real boundary.
-- =====================================================================

drop policy "members delete own company-files objects" on storage.objects;

create policy "uploader or managers delete company-files objects" on storage.objects
  for delete
  using (
    bucket_id = 'company-files'
    and exists (
      select 1 from public.files f
      where f.storage_path = storage.objects.name
        and (f.uploaded_by = auth.uid() or public.has_min_role(f.company_id, 'manager'))
    )
  );
