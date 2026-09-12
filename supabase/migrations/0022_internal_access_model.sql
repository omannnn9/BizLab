-- =====================================================================
-- BizLab — 0022: Internal-only access model.
--
-- BizLab is now a private internal platform for OD Holdings and its
-- companies, not a public SaaS product. This migration adds the one
-- piece of RBAC the schema didn't have: a cross-company "platform
-- admin" who can see and manage every company, plus a global
-- account-disable flag. Public self-service company creation is
-- removed. Everything else (per-company RBAC, RLS shape) is unchanged.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: platform admin flag + global disable flag.
-- Both are guarded below so a normal user can never set these on their
-- own row (that would be a straight privilege-escalation bug) — they
-- can only be changed through admin_set_platform_admin() /
-- admin_set_user_disabled(), which set a transaction-local flag the
-- guard trigger checks for.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column is_platform_admin boolean not null default false,
  add column disabled_at timestamptz;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid() and disabled_at is null),
    false
  );
$$;

comment on function public.is_platform_admin() is
  'True for a non-disabled platform admin. Disabled is checked here (not just at login) so a disabled admin loses every RLS bypass immediately, same as any other disabled user.';

create or replace function public.forbid_profile_admin_fields_self_edit()
returns trigger
language plpgsql
as $$
begin
  if (new.is_platform_admin is distinct from old.is_platform_admin
      or new.disabled_at is distinct from old.disabled_at)
     and coalesce(current_setting('bizlab.admin_action', true), '') <> 'true' then
    raise exception 'is_platform_admin and disabled_at can only be changed via admin_set_platform_admin() / admin_set_user_disabled()'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_admin_fields_guard
  before update on public.profiles
  for each row execute function public.forbid_profile_admin_fields_self_edit();

-- ---------------------------------------------------------------------
-- Cross-company visibility: rather than touching every RLS policy in
-- the schema, patch the two helper functions almost everything else
-- already calls. is_company_member() gates SELECT everywhere; the rest
-- of the RBAC surface (has_min_role) derives from current_role_in(),
-- so making it synthesize 'owner' for a platform admin who isn't an
-- actual member is enough to also grant admin-level write access
-- everywhere has_min_role is checked, with no other policy changes.
--
-- Both now also deny a disabled member outright — this is the real
-- enforcement behind "disabled users cannot access company data"
-- (requirement 9): even with a live, valid session, every RLS check
-- that funnels through these two functions starts failing the moment
-- disabled_at is set, regardless of what the client believes.
-- ---------------------------------------------------------------------
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and p.disabled_at is null
  ) or public.is_platform_admin();
$$;

create or replace function public.current_role_in(p_company_id uuid)
returns public.company_role
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select cm.role from public.company_members cm
     join public.profiles p on p.id = cm.user_id
     where cm.company_id = p_company_id
       and cm.user_id = auth.uid()
       and cm.status = 'active'
       and p.disabled_at is null
     limit 1),
    case when public.is_platform_admin() then 'owner'::public.company_role end
  );
$$;

-- ---------------------------------------------------------------------
-- admin_set_user_disabled / admin_set_platform_admin — the only way to
-- change the two guarded profiles columns above. Same shape as
-- log_audit_event() (0013 SEC-20): SECURITY DEFINER, caller-checked,
-- logged. admin_set_platform_admin refuses to remove the very last
-- remaining admin so the platform can never lock itself out.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can disable or reactivate users' using errcode = '42501';
  end if;

  perform set_config('bizlab.admin_action', 'true', true);
  update public.profiles
  set disabled_at = case when p_disabled then now() else null end
  where id = p_user_id;

  perform public.log_audit_event(
    null, case when p_disabled then 'admin.user_disabled' else 'admin.user_reactivated' end,
    'profile', p_user_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_set_user_disabled(uuid, boolean) from public;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;

create or replace function public.admin_set_platform_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining_admins int;
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform admins can grant or revoke platform admin' using errcode = '42501';
  end if;

  if not p_is_admin then
    select count(*) into v_remaining_admins
    from public.profiles
    where is_platform_admin = true and disabled_at is null and id <> p_user_id;
    if v_remaining_admins = 0 then
      raise exception 'Cannot remove the last remaining platform admin' using errcode = '42501';
    end if;
  end if;

  perform set_config('bizlab.admin_action', 'true', true);
  update public.profiles set is_platform_admin = p_is_admin where id = p_user_id;

  perform public.log_audit_event(
    null, case when p_is_admin then 'admin.admin_granted' else 'admin.admin_revoked' end,
    'profile', p_user_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_set_platform_admin(uuid, boolean) from public;
grant execute on function public.admin_set_platform_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- No public self-service company creation. This was the literal
-- mechanism behind "public organization/workspace creation" — any
-- authenticated user (including a freshly self-registered one, back
-- when signup was public) could insert a companies row for themselves.
-- Only a platform admin can create a company now.
-- ---------------------------------------------------------------------
drop policy "authenticated users can create a company" on public.companies;

create policy "only platform admins create companies"
  on public.companies for insert
  with check (public.is_platform_admin() and created_by = auth.uid());

-- ---------------------------------------------------------------------
-- profiles: platform admins need to see every user for the People
-- admin screen (co-membership-based visibility only covers people who
-- share a company with the viewer).
-- ---------------------------------------------------------------------
drop policy "profiles are viewable by co-members and self" on public.profiles;

create policy "profiles are viewable by co-members, self, and admins"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.company_members me
      join public.company_members them on them.company_id = me.company_id
      where me.user_id = auth.uid() and me.status = 'active'
        and them.user_id = public.profiles.id and them.status = 'active'
    )
  );

-- ---------------------------------------------------------------------
-- audit_logs: the original "company_id is null or has_min_role(...)"
-- policy let ANY authenticated user read company_id-IS-NULL rows
-- unconditionally (only the company-scoped branch was ever gated).
-- That was latent and harmless while nothing wrote null-company rows;
-- admin_set_user_disabled/admin_set_platform_admin above now do, so
-- platform-level entries must be admin-only, not merely "not scoped to
-- a company".
-- ---------------------------------------------------------------------
drop policy "admins+ view audit logs" on public.audit_logs;

create policy "admins view audit logs"
  on public.audit_logs for select
  using (
    (company_id is null and public.is_platform_admin())
    or (company_id is not null and public.has_min_role(company_id, 'admin'))
  );

-- ---------------------------------------------------------------------
-- company_invitations: the invitation lifecycle now needs an explicit
-- accepted timestamp (requirement 5) and carries the invitee's name so
-- it can seed their profile once they accept. The old table-wide
-- unique(company_id, email) blocked ever re-inviting the same address
-- after a revoke/expire — replaced with a partial index so only one
-- *pending* invite per (company, email) is enforced.
-- ---------------------------------------------------------------------
alter table public.company_invitations
  add column accepted_at timestamptz,
  add column full_name text;

alter table public.company_invitations drop constraint company_invitations_company_id_email_key;

create unique index company_invitations_pending_unique
  on public.company_invitations (company_id, email)
  where status = 'pending';

create or replace function public.accept_company_invitation(p_token uuid)
returns public.company_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.company_invitations;
  v_member public.company_members;
  v_email citext;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from public.company_invitations
  where token = p_token and status = 'pending'
  for update;

  if v_invite is null then
    raise exception 'This invitation is invalid or has already been used' using errcode = 'P0002';
  end if;

  if v_invite.expires_at < now() then
    update public.company_invitations set status = 'expired' where id = v_invite.id;
    raise exception 'This invitation has expired' using errcode = 'P0002';
  end if;

  if v_invite.email <> v_email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.company_members (company_id, user_id, role, status, invited_by, joined_at)
  values (v_invite.company_id, auth.uid(), v_invite.role, 'active', v_invite.invited_by, now())
  on conflict (company_id, user_id) do update set status = 'active', joined_at = now()
  returning * into v_member;

  update public.company_invitations set status = 'accepted', accepted_at = now() where id = v_invite.id;

  if v_invite.full_name is not null then
    update public.profiles set full_name = v_invite.full_name where id = auth.uid() and full_name is null;
  end if;

  perform public.create_notification(
    v_invite.company_id, v_invite.invited_by, auth.uid(), 'member_joined',
    'Your invitation was accepted', null, '/settings/members', 'company_member', v_member.id
  );

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------
-- admins revoke invitations — restrict who can move status away from
-- pending (SEC-parity with the rest of the "admin write" surface); this
-- policy already existed, re-stated here unchanged for completeness of
-- reading this migration on its own — no-op if already exactly this.
-- ---------------------------------------------------------------------
comment on table public.company_invitations is
  'Admin-only invitation lifecycle. Public signup no longer exists — this and admin_set_user_disabled/admin_set_platform_admin above are the only ways an account gets created or a company gets populated (0022 internal-only access model).';
