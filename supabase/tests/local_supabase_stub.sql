-- Minimal stub of what a real Supabase project provides, just enough
-- surface area for supabase/migrations/*.sql to apply cleanly against
-- a bare local Postgres for verification purposes.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- In real Supabase, auth.uid() reads a JWT claim from the request
-- context (a GUC set per-connection by PostgREST). We fake it with a
-- session-local setting so we can flip "the current user" per test.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Real Supabase projects grant EXECUTE on auth.uid()/auth.jwt()/
-- auth.role() to anon and authenticated as part of the platform setup
-- (every RLS policy that does `created_by = auth.uid()` depends on
-- this) — replicate that grant here, or any SECURITY INVOKER function
-- that calls auth.uid() fails with "permission denied for schema auth"
-- in this local stub even though it works fine on a real project.
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid
);
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
