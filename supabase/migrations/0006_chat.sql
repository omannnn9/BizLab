-- =====================================================================
-- BizLab — 0006: Team chat (channels, DMs, messages, reactions)
-- =====================================================================

create type public.channel_type as enum ('public', 'private', 'direct', 'group');

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text, -- null for direct messages
  description text,
  type public.channel_type not null default 'public',
  is_archived boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_chat_channels_company on public.chat_channels (company_id);

create trigger trg_chat_channels_updated_at
  before update on public.chat_channels
  for each row execute function public.set_updated_at();

create table public.chat_channel_members (
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  channel_role text not null default 'member' check (channel_role in ('owner', 'member')),
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (channel_id, member_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  body text,
  attachments jsonb not null default '[]'::jsonb, -- [{name, storage_path, size, mime_type}]
  parent_message_id uuid references public.chat_messages (id) on delete cascade,
  mentions uuid[] not null default '{}',
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_channel on public.chat_messages (channel_id, created_at desc);
create index idx_chat_messages_body_trgm on public.chat_messages using gin (body gin_trgm_ops);

create table public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  member_id uuid not null references public.company_members (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, member_id, emoji)
);

-- ---------------------------------------------------------------------
-- helper: is the current user a member of this channel?
-- ---------------------------------------------------------------------
create or replace function public.is_channel_member(p_channel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.chat_channel_members ccm
    where ccm.channel_id = p_channel_id and ccm.member_id = public.member_id_in(
      (select company_id from public.chat_channels where id = p_channel_id)
    )
  );
$$;

-- ---------------------------------------------------------------------
-- default channels + folders seeded whenever a company is created
-- ---------------------------------------------------------------------
create or replace function public.seed_company_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_channel_id uuid;
  v_channel_name text;
  v_folder_name text;
  v_dashboard_id uuid;
  v_widget_type text;
begin
  insert into public.company_members (company_id, user_id, role, status, joined_at)
  values (new.id, new.created_by, 'owner', 'active', now())
  returning id into v_member_id;

  foreach v_channel_name in array array['General', 'Announcements', 'Product', 'Sales', 'Marketing', 'Support']
  loop
    insert into public.chat_channels (company_id, name, type, created_by)
    values (new.id, v_channel_name, (case when v_channel_name = 'Announcements' then 'private' else 'public' end)::public.channel_type, new.created_by)
    returning id into v_channel_id;

    insert into public.chat_channel_members (channel_id, member_id, channel_role)
    values (v_channel_id, v_member_id, 'owner');
  end loop;

  foreach v_folder_name in array array['HR', 'Sales', 'Finance', 'Marketing', 'Operations']
  loop
    insert into public.folders (company_id, module, name, created_by)
    values (new.id, 'documents', v_folder_name, new.created_by);
  end loop;

  insert into public.dashboards (company_id, name, is_default, created_by)
  values (new.id, 'Overview', true, new.created_by)
  returning id into v_dashboard_id;

  foreach v_widget_type in array array[
    'task_completion', 'my_tasks', 'upcoming_deadlines', 'projects_overview', 'storage_usage', 'recent_activity'
  ]
  loop
    insert into public.dashboard_widgets (dashboard_id, widget_type)
    values (v_dashboard_id, v_widget_type::public.widget_type);
  end loop;

  return new;
end;
$$;

create trigger trg_seed_company_defaults
  after insert on public.companies
  for each row execute function public.seed_company_defaults();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.chat_channels enable row level security;
alter table public.chat_channel_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;

create policy "members view public channels or ones they belong to"
  on public.chat_channels for select
  using (
    public.is_company_member(company_id)
    and (type = 'public' or public.is_channel_member(id))
  );

create policy "employees+ create channels"
  on public.chat_channels for insert
  with check (public.is_company_member(company_id) and created_by = auth.uid());

create policy "owners or managers update channels"
  on public.chat_channels for update
  using (public.is_channel_member(id) or public.has_min_role(company_id, 'manager'));

create policy "view own channel memberships"
  on public.chat_channel_members for select
  using (exists (select 1 from public.chat_channels c where c.id = channel_id and public.is_company_member(c.company_id)));

create policy "members join public channels or are added"
  on public.chat_channel_members for insert
  with check (exists (select 1 from public.chat_channels c where c.id = channel_id and public.is_company_member(c.company_id)));

create policy "members leave channels"
  on public.chat_channel_members for delete
  using (member_id = public.member_id_in((select company_id from public.chat_channels where id = channel_id)));

create policy "channel members view messages"
  on public.chat_messages for select
  using (public.is_channel_member(channel_id));

create policy "channel members send messages"
  on public.chat_messages for insert
  with check (author_id = auth.uid() and public.is_channel_member(channel_id));

create policy "authors edit own messages"
  on public.chat_messages for update
  using (author_id = auth.uid());

create policy "authors delete own messages"
  on public.chat_messages for delete
  using (author_id = auth.uid());

create policy "channel members view reactions"
  on public.chat_reactions for select
  using (exists (select 1 from public.chat_messages m where m.id = message_id and public.is_channel_member(m.channel_id)));

create policy "channel members react"
  on public.chat_reactions for insert
  with check (exists (
    select 1 from public.chat_messages m
    where m.id = message_id and public.is_channel_member(m.channel_id)
  ));

create policy "members remove own reactions"
  on public.chat_reactions for delete
  using (member_id = public.member_id_in((
    select c.company_id from public.chat_messages m
    join public.chat_channels c on c.id = m.channel_id
    where m.id = message_id
  )));
