create type public.motivation_event_type as enum (
  'task_completed',
  'completed_early',
  'focus_task_completed',
  'streak_extended',
  'achievement_unlocked',
  'deadline_approaching',
  'overdue_recovery'
);

alter type public.notification_event_type add value if not exists 'task_completed';
alter type public.notification_event_type add value if not exists 'achievement_unlocked';
alter type public.notification_event_type add value if not exists 'streak_extended';
alter type public.notification_event_type add value if not exists 'deadline_approaching';
alter type public.notification_event_type add value if not exists 'overdue_recovery';

alter table public.task_completions
  add column task_title text,
  add column message_event public.motivation_event_type,
  add column message_tone public.motivation_tone;

update public.task_completions as completion
set task_title = task.title,
    message_event = 'focus_task_completed',
    message_tone = 'friendly'
from public.tasks as task
where task.id = completion.task_id
  and (
    completion.task_title is null
    or completion.message_event is null
    or completion.message_tone is null
  );

update public.task_completions
set message_event = 'focus_task_completed',
    message_tone = 'friendly'
where message_event is null or message_tone is null;

alter table public.task_completions
  alter column task_title set not null,
  alter column message_event set not null,
  alter column message_tone set not null;

create table public.motivation_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  deadline_nudges_enabled boolean not null default true,
  celebration_animation_enabled boolean not null default true,
  achievement_visibility_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.motivation_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

alter table public.motivation_preferences enable row level security;

create policy "users read their motivation preferences"
on public.motivation_preferences for select to authenticated
using (user_id = auth.uid());

grant select on public.motivation_preferences to authenticated;

alter table public.notifications
  add column project_id uuid references public.projects (id),
  add column task_id uuid references public.tasks (id),
  add column deadline_at timestamptz;

update public.notifications as notification
set project_id = completion.project_id,
    task_id = completion.task_id
from public.task_completions as completion
where notification.source_id = completion.id;

alter table public.notifications
  drop constraint notifications_user_id_event_type_source_id_key;

alter table public.notifications
  add constraint notifications_deadline_shape check (
    (
      event_type::text in ('deadline_approaching', 'overdue_recovery')
      and deadline_at is not null
      and task_id is not null
    )
    or (
      event_type::text not in ('deadline_approaching', 'overdue_recovery')
      and deadline_at is null
    )
  );

create unique index notifications_completion_identity_idx
  on public.notifications (user_id, event_type, source_id)
  where deadline_at is null;

create unique index notifications_deadline_identity_idx
  on public.notifications (user_id, task_id, event_type, deadline_at)
  where deadline_at is not null;

create index notifications_user_history_idx
  on public.notifications (user_id, created_at desc, id desc);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc, id desc)
  where read_at is null;

create index tasks_open_deadline_idx
  on public.tasks (assignee_id, due_at)
  where due_at is not null and status <> 'done';

create function public.protect_notification_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'notifications cannot be deleted' using errcode = '55000';
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.workspace_id is distinct from old.workspace_id
    or new.event_type is distinct from old.event_type
    or new.source_id is distinct from old.source_id
    or new.tone is distinct from old.tone
    or new.template_key is distinct from old.template_key
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at
    or new.project_id is distinct from old.project_id
    or new.task_id is distinct from old.task_id
    or new.deadline_at is distinct from old.deadline_at
    or (old.read_at is not null and new.read_at is distinct from old.read_at)
    or (old.read_at is null and new.read_at is null) then
    raise exception 'notification content is immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger notification_content_is_immutable
before update or delete on public.notifications
for each row execute function public.protect_notification_content();

insert into public.achievement_definitions (code, name, description, icon)
values
  ('first_step', 'First Step', 'Complete your first task.', 'footprints'),
  ('focused_finish', 'Focused Finish', 'Complete your first Focus Task.', 'target'),
  ('momentum_three', 'Momentum Three', 'Reach a three-workday Focus Streak.', 'flame'),
  ('five_day_flow', 'Five-Day Flow', 'Reach a five-workday Focus Streak.', 'waves'),
  ('ahead_of_schedule', 'Ahead of Schedule', 'Complete a task at least 24 hours early.', 'clock-check')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon;

create or replace function public.initialize_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := trim(
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  );
  requested_timezone text := coalesce(
    new.raw_user_meta_data ->> 'timezone',
    ''
  );
begin
  if char_length(requested_name) not between 1 and 80 then
    raise exception 'valid display_name metadata is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = requested_timezone
  ) then
    raise exception 'valid timezone metadata is required' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, timezone, motivation_tone)
  values (new.id, requested_name, requested_timezone, 'friendly')
  on conflict (id) do nothing;

  insert into public.motivation_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.initialize_auth_profile()
from public, anon, authenticated;
