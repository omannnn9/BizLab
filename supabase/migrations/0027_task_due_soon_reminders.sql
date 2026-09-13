-- =====================================================================
-- BizLab — 0027: Deadline reminders for delegated tasks
-- =====================================================================
-- 0014_notifications_and_invitations.sql defined the 'task_due_soon'
-- notification type and even reserved it in the enum, but nothing ever
-- created one — a task could be assigned with a deadline and nobody
-- was ever reminded as it approached. task_assigned notifications
-- (delegation) already worked via trg_on_task_assigned; this adds the
-- other half: an hourly pg_cron job that reminds every assignee of a
-- task due today or tomorrow, once per task (dedup by checking for an
-- existing task_due_soon notification for that task+recipient, so
-- re-running hourly doesn't spam).

create extension if not exists pg_cron;

create or replace function public.notify_tasks_due_soon()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task record;
begin
  for v_task in
    select t.id, t.company_id, t.title, t.due_date, cm.user_id as recipient_id
    from public.tasks t
    join public.task_assignees ta on ta.task_id = t.id
    join public.company_members cm on cm.id = ta.member_id
    where t.due_date between current_date and current_date + 1
      and t.status not in ('done', 'cancelled')
      and not exists (
        select 1 from public.notifications n
        where n.type = 'task_due_soon' and n.entity_type = 'task'
          and n.entity_id = t.id and n.recipient_id = cm.user_id
      )
  loop
    perform public.create_notification(
      v_task.company_id, v_task.recipient_id, null, 'task_due_soon',
      'Task due soon',
      v_task.title || ' is due ' || to_char(v_task.due_date, 'Mon DD'),
      '/tasks?task=' || v_task.id, 'task', v_task.id
    );
  end loop;
end;
$$;

revoke all on function public.notify_tasks_due_soon() from public;

select cron.schedule(
  'notify-tasks-due-soon',
  '0 * * * *', -- hourly, on the hour
  $$select public.notify_tasks_due_soon()$$
);
