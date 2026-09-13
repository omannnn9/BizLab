-- =====================================================================
-- BizLab — 0025: Allow overwriting file content (live document editing)
-- =====================================================================
-- 0005_files_storage.sql granted select/insert/delete on the
-- `company-files` bucket but never update, so there was no way to save
-- edits back to an existing object's storage path. Needed for the new
-- in-app editor for uploaded Word/Excel files (docx/xlsx), which loads
-- the file, lets the user edit it, and re-uploads to the same path.

create policy "uploader or managers update company-files objects"
  on storage.objects for update
  using (
    bucket_id = 'company-files'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'company-files'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );
