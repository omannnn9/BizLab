-- =====================================================================
-- BizLab — 0012: Global search across tasks, projects, documents,
-- files, chat messages and people. RLS-safe because it's SECURITY
-- INVOKER and simply unions each already-protected table.
-- =====================================================================

create type public.search_result_type as enum (
  'task', 'project', 'document', 'file', 'chat_message', 'knowledge_article', 'user'
);

create or replace function public.global_search(p_company_id uuid, p_query text, p_limit int default 30)
returns table (
  result_type public.search_result_type,
  id uuid,
  title text,
  snippet text,
  url_path text,
  rank real
)
language sql
security invoker
stable
set search_path = public
as $$
  with q as (select websearch_to_tsquery('english', p_query) as tsq, p_query as raw)
  select 'task'::public.search_result_type, t.id, t.title,
         left(coalesce(t.description, ''), 140),
         '/tasks/' || t.id,
         similarity(t.title, (select raw from q))
  from public.tasks t, q
  where t.company_id = p_company_id and t.title % (select raw from q)

  union all
  select 'project', p.id, p.name, left(coalesce(p.description, ''), 140), '/projects/' || p.id,
         similarity(p.name, (select raw from q))
  from public.projects p, q
  where p.company_id = p_company_id and p.name % (select raw from q)

  union all
  select 'document', d.id, d.title, '', '/documents/' || d.id,
         similarity(d.title, (select raw from q))
  from public.documents d, q
  where d.company_id = p_company_id and public.document_access_level(d.id) is not null
    and d.title % (select raw from q)

  union all
  select 'file', f.id, f.name, '', '/files/' || f.id,
         similarity(f.name, (select raw from q))
  from public.files f, q
  where f.company_id = p_company_id and f.deleted_at is null and f.name % (select raw from q)

  union all
  select 'chat_message', m.id, left(m.body, 60), left(m.body, 140), '/chat/' || m.channel_id || '?message=' || m.id,
         similarity(coalesce(m.body, ''), (select raw from q))
  from public.chat_messages m
  join public.chat_channels c on c.id = m.channel_id, q
  where c.company_id = p_company_id and m.deleted_at is null
    and public.is_channel_member(m.channel_id)
    and coalesce(m.body, '') % (select raw from q)

  union all
  select 'knowledge_article', k.id, k.title, left(k.title, 140), '/knowledge/' || k.id,
         similarity(k.title, (select raw from q))
  from public.knowledge_articles k, q
  where k.company_id = p_company_id and k.is_published and k.title % (select raw from q)

  union all
  select 'user', cm.id, pr.full_name, pr.email, '/people/' || cm.id,
         similarity(coalesce(pr.full_name, pr.email), (select raw from q))
  from public.company_members cm
  join public.profiles pr on pr.id = cm.user_id, q
  where cm.company_id = p_company_id and cm.status = 'active'
    and (coalesce(pr.full_name, '') % (select raw from q) or pr.email % (select raw from q))

  order by rank desc
  limit p_limit;
$$;
