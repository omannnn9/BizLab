-- =====================================================================
-- BizLab — 0015: Documents upgrade — nested pages, templates, and a
-- real version-history trail (previously the table existed but nothing
-- ever wrote to it outside a manual RPC-less insert path).
-- =====================================================================

alter table public.documents
  add column parent_document_id uuid references public.documents (id) on delete set null,
  add column is_template boolean not null default false;

create index idx_documents_parent on public.documents (parent_document_id);

-- A document cannot be its own ancestor. Cheap, direct-parent-only
-- check here; the RLS access model doesn't need full-cycle detection
-- since parent_document_id is purely organizational (breadcrumbs/child
-- lists), not a permission boundary — access is still governed entirely
-- by document_access_level() per document, same as before.
alter table public.documents
  add constraint documents_not_own_parent check (id <> parent_document_id);

-- A document's as-created content must itself be snapshotted as
-- version 1, or there is nothing to restore *to* until after the first
-- edit — confirmed missing by actually exercising restore during
-- hardening verification (asking for version 1 on a freshly created,
-- never-edited document returned "not found").
create or replace function public.snapshot_initial_document_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.document_versions (document_id, version_number, content, title, created_by)
  values (new.id, 1, new.content, new.title, new.created_by);
  return new;
end;
$$;

create trigger trg_documents_initial_version
  after insert on public.documents
  for each row execute function public.snapshot_initial_document_version();

-- ---------------------------------------------------------------------
-- Version snapshots — written by the app on every save via this RPC
-- (rather than a raw insert) so current_version and the version row
-- always move together, and so document.updated activity is logged
-- from the same real save events instead of firing on every keystroke.
-- ---------------------------------------------------------------------
-- SECURITY DEFINER (not invoker): this function calls log_activity(),
-- itself SECURITY DEFINER with EXECUTE revoked from `authenticated` so
-- clients can't forge activity entries directly (see 0013 SEC-19). A
-- SECURITY INVOKER caller runs as `authenticated` and would be denied
-- that call; DEFINER lets it run as the owning role, which always has
-- implicit rights to functions it also owns. The document_access_level
-- check below is what stands in for RLS here — it's the same check the
-- table's own UPDATE policy makes.
create or replace function public.save_document_version(
  p_document_id uuid,
  p_title text,
  p_content jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
begin
  if public.document_access_level(p_document_id) not in ('edit', 'full_control') then
    raise exception 'Not permitted to edit this document' using errcode = '42501';
  end if;

  update public.documents
  set title = p_title, content = p_content, current_version = current_version + 1
  where id = p_document_id
  returning current_version into v_next_version;

  insert into public.document_versions (document_id, version_number, content, title, created_by)
  values (p_document_id, v_next_version, p_content, p_title, auth.uid());

  perform public.log_activity(
    (select company_id from public.documents where id = p_document_id),
    auth.uid(), 'document.updated', 'document', p_document_id, jsonb_build_object('title', p_title)
  );

  return v_next_version;
end;
$$;

revoke all on function public.save_document_version(uuid, text, jsonb) from public;
grant execute on function public.save_document_version(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Restore — copies an old version's content back as the *current*
-- content and takes a new snapshot of it, so restoring is itself
-- undoable and the version list only ever grows, never rewrites
-- history.
-- ---------------------------------------------------------------------
create or replace function public.restore_document_version(p_document_id uuid, p_version_number int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.document_versions;
begin
  select * into v_version from public.document_versions
  where document_id = p_document_id and version_number = p_version_number;

  if v_version is null then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  return public.save_document_version(p_document_id, v_version.title, v_version.content);
end;
$$;

revoke all on function public.restore_document_version(uuid, int) from public;
grant execute on function public.restore_document_version(uuid, int) to authenticated;
