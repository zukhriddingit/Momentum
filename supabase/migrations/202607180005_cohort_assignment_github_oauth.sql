alter table public.profiles
  add column github_user_id bigint,
  add column github_handle text;

alter table public.profiles
  add constraint profiles_github_user_id_positive
    check (github_user_id is null or github_user_id > 0),
  add constraint profiles_github_handle_valid
    check (
      github_handle is null
      or (
        github_handle = lower(github_handle)
        and char_length(github_handle) between 1 and 39
        and github_handle ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'
        and github_handle !~ '--'
      )
    );

create unique index profiles_github_user_id_uq
  on public.profiles (github_user_id)
  where github_user_id is not null;

create unique index profiles_github_handle_uq
  on public.profiles (github_handle)
  where github_handle is not null;

create table public.workspace_cohort_seats (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  github_user_id bigint not null check (github_user_id > 0),
  github_handle text not null,
  user_id uuid references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  constraint workspace_cohort_seats_handle_valid
    check (
      github_handle = lower(github_handle)
      and char_length(github_handle) between 1 and 39
      and github_handle ~ '^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$'
      and github_handle !~ '--'
    ),
  constraint workspace_cohort_seats_claim_consistent
    check ((user_id is null) = (claimed_at is null)),
  unique (workspace_id, github_user_id)
);

create unique index workspace_cohort_seats_workspace_user_uq
  on public.workspace_cohort_seats (workspace_id, user_id)
  where user_id is not null;

create index workspace_cohort_seats_github_user_idx
  on public.workspace_cohort_seats (github_user_id);

alter table public.workspace_cohort_seats enable row level security;

create policy "members read workspace cohort seats"
on public.workspace_cohort_seats
for select
to authenticated
using (public.is_workspace_member(workspace_id));

grant select on public.workspace_cohort_seats to authenticated;

create function public.validate_cohort_seat_claimed_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is not null and not exists (
    select 1
    from public.profiles as profile
    where profile.id = new.user_id
      and profile.github_user_id = new.github_user_id
  ) then
    raise exception 'claimed cohort seat must match the profile GitHub identity'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_cohort_seat_claimed_identity()
from public, anon, authenticated;

create trigger workspace_cohort_seat_verified_identity_matches
before insert or update of github_user_id, user_id on public.workspace_cohort_seats
for each row execute function public.validate_cohort_seat_claimed_identity();

alter table public.tasks alter column assignee_id drop not null;

alter table public.tasks
  add column cohort_seat_id uuid references public.workspace_cohort_seats (id) on delete restrict,
  add constraint tasks_exactly_one_assignee
    check (
      (assignee_id is not null)::integer
        + (cohort_seat_id is not null)::integer
        = 1
    );

create index tasks_cohort_seat_idx
  on public.tasks (cohort_seat_id)
  where cohort_seat_id is not null;

create or replace function public.validate_task_workspace_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  if (new.assignee_id is null) = (new.cohort_seat_id is null) then
    raise exception 'task must have exactly one assignee representation'
      using errcode = '23514';
  end if;

  select project.workspace_id
  into target_workspace_id
  from public.projects as project
  where project.id = new.project_id;

  if new.assignee_id is not null and not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = new.assignee_id
  ) then
    raise exception 'task assignee must belong to the project workspace'
      using errcode = '23514';
  end if;

  if new.cohort_seat_id is not null and not exists (
    select 1
    from public.workspace_cohort_seats as seat
    where seat.id = new.cohort_seat_id
      and seat.workspace_id = target_workspace_id
      and seat.user_id is null
  ) then
    raise exception 'pending task seat must belong to the project workspace'
      using errcode = '23514';
  end if;

  if new.cohort_seat_id is not null and new.status <> 'todo' then
    raise exception 'pending cohort tasks must remain todo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_task_workspace_assignee()
from public, anon, authenticated;

drop trigger tasks_require_workspace_assignee on public.tasks;

create trigger tasks_require_workspace_assignee
before insert or update of project_id, assignee_id, cohort_seat_id, status on public.tasks
for each row execute function public.validate_task_workspace_assignee();

create function public.protect_cohort_seat_claim_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id is null
    and new.user_id is not null
    and exists (
      select 1
      from public.tasks as task
      where task.cohort_seat_id = old.id
    ) then
    raise exception 'pending tasks must be activated before claiming a cohort seat'
      using errcode = '55000';
  end if;

  if old.user_id is not null
    and (
      new.github_user_id is distinct from old.github_user_id
      or new.github_handle is distinct from old.github_handle
      or new.user_id is distinct from old.user_id
      or new.claimed_at is distinct from old.claimed_at
    ) then
    raise exception 'claimed cohort seat identity is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_cohort_seat_claim_order()
from public, anon, authenticated;

create trigger workspace_cohort_seat_claim_is_ordered
before update of github_user_id, github_handle, user_id, claimed_at on public.workspace_cohort_seats
for each row execute function public.protect_cohort_seat_claim_order();

create or replace function public.protect_task_first_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_completed_at is not null then
    if new.first_completed_at is distinct from old.first_completed_at then
      raise exception 'tasks.first_completed_at is immutable once set'
        using errcode = '55000';
    end if;

    if new.assignee_id is distinct from old.assignee_id then
      raise exception 'tasks.assignee_id is immutable after first completion'
        using errcode = '55000';
    end if;

    if new.cohort_seat_id is distinct from old.cohort_seat_id then
      raise exception 'tasks.cohort_seat_id is immutable after first completion'
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.initialize_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_name text;
  requested_timezone text := nullif(metadata ->> 'timezone', '');
begin
  requested_name := left(
    coalesce(
      nullif(trim(metadata ->> 'display_name'), ''),
      nullif(trim(metadata ->> 'full_name'), ''),
      nullif(trim(metadata ->> 'name'), ''),
      nullif(trim(metadata ->> 'user_name'), ''),
      nullif(trim(metadata ->> 'preferred_username'), ''),
      nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Momentum member'
    ),
    80
  );

  if char_length(requested_name) not between 1 and 80 then
    raise exception 'valid display_name metadata is required'
      using errcode = '22023';
  end if;

  if requested_timezone is null then
    requested_timezone := 'UTC';
  elsif not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = requested_timezone
  ) then
    raise exception 'valid timezone metadata is required'
      using errcode = '22023';
  end if;

  insert into public.profiles (
    id,
    display_name,
    timezone,
    motivation_tone
  )
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
