# RLS / security regression tests

These are not unit tests against mocked data — they run all 14
migrations against a **real local Postgres**, then exercise the actual
RLS policies as two real (fake) companies and four (fake) users, using
Postgres role/GUC switching to simulate what PostgREST does per-request
in production. This is how three confirmed, execution-only-detectable
bugs were caught during the 2024 hardening pass (see
`docs/AUDIT_REPORT.md`, findings marked "found via execution testing"):

1. `seed_company_defaults()` — a `CASE WHEN ... THEN 'private' ELSE
   'public' END` with no explicit enum cast failed on every single
   company creation (Postgres resolves ambiguous-literal CASE branches
   to `text`, which doesn't auto-cast to a user-defined enum type). This
   would have broken 100% of signups.
2. An RLS policy added during hardening referenced its own table
   (`chat_channel_members`) in a plain subquery, which Postgres reports
   as "infinite recursion detected in policy" — fixed by routing through
   a `SECURITY DEFINER` helper, the same pattern already used everywhere
   else in the schema.
3. `global_search()` used `similarity()`/`%`, which scores over whole
   strings — a query for "Ship" against the title "Ship the audit fixes"
   scores 0.24, under pg_trgm's 0.3 default threshold, so it silently
   returned nothing. Fixed with `word_similarity()`/`<%`, which is what
   pg_trgm ships specifically for "short query, long field" search.

None of these were catchable by reading the SQL, however carefully —
only by running it. Re-run this suite after any future migration that
touches RLS, triggers, or `global_search()`.

## Running it

```bash
# one-time: local Postgres 16 with pgcrypto/pg_trgm/unaccent/citext available
sudo service postgresql start
sudo -u postgres createdb bizlab_test

# stub the parts of a real Supabase project these migrations assume
# exist (auth.users, auth.uid(), storage.buckets/objects, the
# authenticated/anon/service_role roles)
sudo -u postgres psql -d bizlab_test -f supabase/tests/local_supabase_stub.sql

# apply every migration in order, exactly as Supabase would
for f in supabase/migrations/*.sql; do
  sudo -u postgres psql -d bizlab_test -v ON_ERROR_STOP=1 -f "$f" || { echo "FAILED: $f"; break; }
done

# grant the same table/function access Supabase grants `authenticated`
# by default, then the specific functions this schema explicitly
# exposes to clients (everything else stays revoked — see 0013/0014)
sudo -u postgres psql -d bizlab_test <<'SQL'
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant usage on schema storage to authenticated;
grant all on all tables in schema storage to authenticated;
grant execute on function public.global_search(uuid,text,int) to authenticated;
grant execute on function public.accept_company_invitation(uuid) to authenticated;
grant execute on function public.log_audit_event(uuid,text,text,uuid,jsonb) to authenticated;
grant execute on function public.member_id_in(uuid) to authenticated;
SQL

# run the actual test suite — 16 scenarios, each printing what it
# expects before running it, so ERROR lines next to "Expect ERROR"
# headers are the test passing, not the suite failing
sudo -u postgres psql -d bizlab_test -f supabase/tests/security_rls_test.sql
```

Every `ERROR` in the output should sit directly under a line that says
`Expect ERROR` (or under a test description saying something should be
blocked). An `ERROR` anywhere else, or the *absence* of one under an
"Expect ERROR" line, means a regression.

This is psql-script-based rather than pgTAP because it needed to
exercise real role-switching (`SET ROLE authenticated` +
`SET request.jwt.claim.sub`) to faithfully reproduce how PostgREST
executes requests — pgTAP is a reasonable upgrade path once this is
running in CI against a disposable Supabase branch (see
`docs/ROADMAP.md`).
