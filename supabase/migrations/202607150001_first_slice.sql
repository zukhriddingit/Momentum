create type public.membership_role as enum ('owner', 'admin', 'member');
create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.effort_level as enum ('small', 'medium', 'large', 'extra_large');
create type public.motivation_tone as enum ('calm', 'friendly', 'energetic', 'minimal');
create type public.point_entry_kind as enum ('base', 'timing_bonus', 'streak_bonus');
create type public.notification_event_type as enum ('focus_task_completed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  timezone text not null,
  motivation_tone public.motivation_tone not null default 'friendly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.membership_role not null,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.projects (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 140),
  description text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  assignee_id uuid not null references public.profiles (id),
  status public.task_status not null default 'todo',
  effort public.effort_level not null,
  due_at timestamptz,
  first_completed_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_assignee_idx on public.tasks (assignee_id);

create table public.focus_selections (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  work_date date not null,
  selected_at timestamptz not null,
  completed_at timestamptz,
  unique (user_id, work_date)
);

create index focus_selections_user_date_idx
  on public.focus_selections (user_id, work_date desc);

create table public.focus_streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  longest_count integer not null default 0 check (longest_count >= current_count),
  last_completed_work_date date,
  updated_at timestamptz not null default now()
);

create table public.achievement_definitions (
  code text primary key,
  name text not null,
  description text not null,
  icon text not null
);

create table public.task_completions (
  id uuid primary key,
  task_id uuid not null unique references public.tasks (id),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null references public.projects (id),
  recipient_id uuid not null references public.profiles (id),
  actor_id uuid not null references public.profiles (id),
  focus_selection_id uuid unique references public.focus_selections (id),
  completed_at timestamptz not null,
  base_points integer not null check (base_points > 0),
  timing_multiplier numeric(4, 2) not null check (timing_multiplier >= 1),
  streak_multiplier numeric(4, 2) not null check (streak_multiplier >= 1),
  pre_completion_streak integer not null check (pre_completion_streak >= 0),
  post_completion_streak integer not null check (post_completion_streak >= 0),
  final_points integer not null check (final_points > 0),
  message_template_key text not null,
  message_title text not null,
  message_body text not null,
  created_at timestamptz not null default now()
);

create table public.point_ledger (
  id uuid primary key,
  completion_id uuid not null references public.task_completions (id),
  workspace_id uuid not null references public.workspaces (id),
  project_id uuid not null references public.projects (id),
  user_id uuid not null references public.profiles (id),
  entry_kind public.point_entry_kind not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (completion_id, entry_kind)
);

create index point_ledger_user_created_idx
  on public.point_ledger (user_id, created_at desc);

create table public.achievement_grants (
  id uuid primary key,
  user_id uuid not null references public.profiles (id),
  achievement_code text not null references public.achievement_definitions (code),
  completion_id uuid not null references public.task_completions (id),
  granted_at timestamptz not null,
  unique (user_id, achievement_code)
);

create table public.notifications (
  id uuid primary key,
  user_id uuid not null references public.profiles (id),
  workspace_id uuid not null references public.workspaces (id),
  event_type public.notification_event_type not null,
  source_id uuid not null,
  tone public.motivation_tone not null,
  template_key text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_type, source_id)
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create view public.project_progress
with (security_invoker = true)
as
select
  project.id as project_id,
  project.workspace_id,
  count(task.id)::integer as total_tasks,
  count(task.id) filter (where task.status = 'done')::integer as done_tasks,
  case
    when count(task.id) = 0 then 0
    else floor(
      100.0 * count(task.id) filter (where task.status = 'done') / count(task.id)
    )::integer
  end as percent_complete
from public.projects as project
left join public.tasks as task on task.project_id = project.id
group by project.id, project.workspace_id;

create function public.is_workspace_member(
  target_workspace_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = target_user_id
  );
$$;

create function public.shares_workspace(left_user_id uuid, right_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_memberships as left_membership
    join public.workspace_memberships as right_membership
      on right_membership.workspace_id = left_membership.workspace_id
    where left_membership.user_id = left_user_id
      and right_membership.user_id = right_user_id
  );
$$;

revoke all on function public.is_workspace_member(uuid, uuid) from public;
revoke all on function public.shares_workspace(uuid, uuid) from public;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.shares_workspace(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.focus_selections enable row level security;
alter table public.focus_streaks enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.task_completions enable row level security;
alter table public.point_ledger enable row level security;
alter table public.achievement_grants enable row level security;
alter table public.notifications enable row level security;

create policy "profiles visible to workspace peers"
on public.profiles for select to authenticated
using (id = auth.uid() or public.shares_workspace(auth.uid(), id));

create policy "members read their workspaces"
on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

create policy "members read workspace memberships"
on public.workspace_memberships for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "members read projects"
on public.projects for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "members read tasks"
on public.tasks for select to authenticated
using (
  exists (
    select 1
    from public.projects as project
    where project.id = tasks.project_id
      and public.is_workspace_member(project.workspace_id)
  )
);

create policy "users read their focus selections"
on public.focus_selections for select to authenticated
using (user_id = auth.uid());

create policy "users read their streak"
on public.focus_streaks for select to authenticated
using (user_id = auth.uid());

create policy "authenticated users read achievement definitions"
on public.achievement_definitions for select to authenticated
using (true);

create policy "users read their completion receipts"
on public.task_completions for select to authenticated
using (recipient_id = auth.uid());

create policy "users read their point ledger"
on public.point_ledger for select to authenticated
using (user_id = auth.uid());

create policy "users read their achievement grants"
on public.achievement_grants for select to authenticated
using (user_id = auth.uid());

create policy "users read their notifications"
on public.notifications for select to authenticated
using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select on
  public.profiles,
  public.workspaces,
  public.workspace_memberships,
  public.projects,
  public.tasks,
  public.focus_selections,
  public.focus_streaks,
  public.achievement_definitions,
  public.task_completions,
  public.point_ledger,
  public.achievement_grants,
  public.notifications,
  public.project_progress
to authenticated;

create function public.prevent_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '55000';
end;
$$;

create trigger task_completions_are_immutable
before update or delete on public.task_completions
for each row execute function public.prevent_immutable_change();

create trigger point_ledger_is_immutable
before update or delete on public.point_ledger
for each row execute function public.prevent_immutable_change();

create trigger achievement_grants_are_immutable
before update or delete on public.achievement_grants
for each row execute function public.prevent_immutable_change();

create function public.protect_task_first_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_completed_at is not null
    and new.first_completed_at is distinct from old.first_completed_at then
    raise exception 'tasks.first_completed_at is immutable once set' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger task_first_completion_is_immutable
before update on public.tasks
for each row execute function public.protect_task_first_completion();

create function public.protect_completed_focus_selection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.completed_at is not null then
    raise exception 'completed focus selections are immutable' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger completed_focus_selections_are_immutable
before update or delete on public.focus_selections
for each row
when (old.completed_at is not null)
execute function public.protect_completed_focus_selection();

insert into public.achievement_definitions (code, name, description, icon)
values (
  'momentum_three',
  'Momentum Three',
  'Complete Focus Tasks across a three-day commitment streak.',
  'flame'
);
