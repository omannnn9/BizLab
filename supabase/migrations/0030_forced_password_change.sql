-- =====================================================================
-- Admin-set temporary passwords: creating a brand-new user now takes an
-- admin-chosen temp password instead of relying on Supabase's invite
-- email (see the invite-user edge function change alongside this
-- migration). The new user signs in with that password directly and is
-- forced to set their own before they can use the app.
-- =====================================================================

alter table public.profiles add column must_change_password boolean not null default false;

-- handle_new_user() now also seeds must_change_password from
-- raw_user_meta_data at account-creation time. This is an INSERT, so
-- the admin-fields guard trigger below (which only fires on UPDATE)
-- never applies here — no chicken-and-egg problem with the guard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, must_change_password)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Extend the existing admin-fields guard (0022_internal_access_model.sql)
-- so must_change_password can only be cleared via clear_must_change_password()
-- below, never by a direct profiles UPDATE — otherwise a user could just
-- PATCH their own profile to skip the forced password change entirely.
create or replace function public.forbid_profile_admin_fields_self_edit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.is_platform_admin is distinct from old.is_platform_admin
      or new.disabled_at is distinct from old.disabled_at
      or new.must_change_password is distinct from old.must_change_password)
     and coalesce(current_setting('bizlab.admin_action', true), '') <> 'true' then
    raise exception 'is_platform_admin, disabled_at, and must_change_password can only be changed via admin_set_platform_admin() / admin_set_user_disabled() / clear_must_change_password()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Called by a signed-in user right after they successfully change their
-- own password (supabase.auth.updateUser({password})) — clears the
-- forced-change flag on their own profile only.
create or replace function public.clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('bizlab.admin_action', 'true', true);
  update public.profiles set must_change_password = false where id = auth.uid();
end;
$$;

revoke all on function public.clear_must_change_password() from public;
grant execute on function public.clear_must_change_password() to authenticated;
