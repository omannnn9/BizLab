-- Fixture setup (as postgres / superuser, bypasses RLS)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@acme.test'),
  ('22222222-2222-2222-2222-222222222222', 'bob@wayne.test'),
  ('33333333-3333-3333-3333-333333333333', 'carol@acme.test')
on conflict (id) do nothing;

update public.profiles set full_name = 'Alice Owner' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set full_name = 'Bob Owner' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set full_name = 'Carol Employee' where id = '33333333-3333-3333-3333-333333333333';

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into public.companies (id, name, slug, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Acme', 'acme', '11111111-1111-1111-1111-111111111111');
reset role;
reset request.jwt.claim.sub;

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
insert into public.companies (id, name, slug, created_by)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'Wayne Corp', 'wayne', '22222222-2222-2222-2222-222222222222');
reset role;
reset request.jwt.claim.sub;

insert into public.company_members (company_id, user_id, role, status, joined_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'employee', 'active', now());

\echo '=== FIXTURES READY ==='
select name, slug from public.companies order by name;
select c.name, cm.role, p.full_name from public.company_members cm join public.companies c on c.id=cm.company_id join public.profiles p on p.id = cm.user_id order by 1,3;

\echo ''
\echo '--- TEST 1: Carol uploads a file, then tries to pivot its company_id to Wayne Corp (SEC-01..11) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
insert into public.files (id, company_id, name, storage_path, file_size, uploaded_by)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'secret.pdf', 'aaaaaaaa-0000-0000-0000-000000000001/uuid-secret.pdf', 1000, '33333333-3333-3333-3333-333333333333');
\echo 'Expect ERROR (immutable company_id):'
update public.files set company_id = 'bbbbbbbb-0000-0000-0000-000000000002' where id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 2: Bob (Wayne, not an Acme member at all) tries to join Acme private Announcements channel ---'
select id as acme_announcements from public.chat_channels where company_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'Announcements' \gset
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
\echo 'Expect: insert affects 0 rows (RLS blocks, Bob is not even an Acme member so member_id_in returns null)'
insert into public.chat_channel_members (channel_id, member_id, channel_role)
values (:'acme_announcements', public.member_id_in('aaaaaaaa-0000-0000-0000-000000000001'), 'member');
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 3: Carol (real Acme employee, never invited to Announcements) tries to self-join the PRIVATE channel (SEC-12) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
insert into public.chat_channel_members (channel_id, member_id, channel_role)
values (:'acme_announcements', public.member_id_in('aaaaaaaa-0000-0000-0000-000000000001'), 'member');
reset role;
reset request.jwt.claim.sub;
\echo 'Row count after attempted self-join to private channel (expect 0):'
select count(*) from public.chat_channel_members where channel_id = :'acme_announcements';

\echo ''
\echo '--- TEST 4: Carol self-joins the PUBLIC "General" channel (should succeed) ---'
select id as acme_general from public.chat_channels where company_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'General' \gset
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
insert into public.chat_channel_members (channel_id, member_id, channel_role)
values (:'acme_general', public.member_id_in('aaaaaaaa-0000-0000-0000-000000000001'), 'member');
reset role;
reset request.jwt.claim.sub;
\echo 'Row count after self-join to public channel (expect 1):'
select count(*) from public.chat_channel_members where channel_id = :'acme_general';

\echo ''
\echo '--- TEST 5: Carol forges a direct audit_logs insert (SEC-20 — expect ERROR, no insert policy exists) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
insert into public.audit_logs (company_id, actor_id, action) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'member.role_changed');
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 6: Carol uses the sanctioned log_audit_event() RPC for her own company (should succeed, actor forced server-side) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select public.log_audit_event('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'member.self_test', 'company_member', null, '{}'::jsonb);
reset role;
reset request.jwt.claim.sub;
select action, actor_id from public.audit_logs order by created_at desc limit 1;

\echo ''
\echo '--- TEST 7: Carol calls log_audit_event() against Wayne Corp, which she is not a member of (expect ERROR) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select public.log_audit_event('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'member.role_changed', null, null, '{}'::jsonb);
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 8: Carol tries to directly call the internal create_notification() helper (expect permission-denied) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
select public.create_notification('aaaaaaaa-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'task_assigned'::public.notification_type, 'fake', null, null, null, null);
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 9: real notification flow — Alice assigns a task to Carol (FUNC-01) ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into public.tasks (id, company_id, title, created_by) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ship the audit fixes', '11111111-1111-1111-1111-111111111111');
insert into public.task_assignees (task_id, member_id)
select 'dddddddd-0000-0000-0000-000000000001', id from public.company_members where user_id = '33333333-3333-3333-3333-333333333333';
reset role;
reset request.jwt.claim.sub;

set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
\echo 'Carol should see exactly 1 unread task_assigned notification:'
select type, title, is_read from public.notifications where recipient_id = '33333333-3333-3333-3333-333333333333';
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 10: notification recipient tries to rewrite the content, only is_read/read_at may change (SEC-18) ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
\echo 'Expect ERROR:'
update public.notifications set title = 'forged title' where recipient_id = '33333333-3333-3333-3333-333333333333';
\echo 'Expect success (allowed column):'
update public.notifications set is_read = true, read_at = now() where recipient_id = '33333333-3333-3333-3333-333333333333';
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 11: invitation acceptance end-to-end (FUNC-02) ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
insert into public.company_invitations (company_id, email, role, invited_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'dave@acme.test', 'manager', '11111111-1111-1111-1111-111111111111')
returning token as dave_token \gset
reset role;
reset request.jwt.claim.sub;

insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'dave@acme.test') on conflict (id) do nothing;

set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
set role authenticated;
select role, status from public.accept_company_invitation(:'dave_token');
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 12: storage quota enforcement (FUNC-03) ---'
update public.companies set storage_quota_bytes = 500 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
\echo 'Uploading 1000 bytes against a 500-byte quota, expect ERROR:'
insert into public.files (company_id, name, storage_path, file_size, uploaded_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'big.pdf', 'aaaaaaaa-0000-0000-0000-000000000001/uuid-big.pdf', 1000, '11111111-1111-1111-1111-111111111111');
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 13: cross-tenant isolation sanity check — Bob (Wayne) sees zero Acme rows anywhere, including via global_search ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select count(*) as acme_tasks_visible_to_bob from public.tasks where company_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select count(*) as acme_files_visible_to_bob from public.files where company_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select count(*) as acme_members_visible_to_bob from public.company_members where company_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select count(*) as search_hits_for_bob from public.global_search('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Ship', 10);
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 14: same search, run by Alice, a real Acme member (should find the task) ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select result_type, title from public.global_search('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'Ship', 10);
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '--- TEST 15: file size / mime-type limits registered on the storage bucket (SEC-23) ---'
select id, file_size_limit, allowed_mime_types from storage.buckets order by id;

\echo ''
\echo '--- TEST 16: activity feed actually has real entries now (FUNC-01) ---'
select action, entity_type from public.activity_logs order by created_at;
