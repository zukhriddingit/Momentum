create function public.initialize_auth_profile()
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

  return new;
end;
$$;

revoke all on function public.initialize_auth_profile() from public, anon, authenticated;

create trigger initialize_auth_profile_after_insert
after insert on auth.users
for each row execute function public.initialize_auth_profile();

create function public.validate_task_workspace_assignee()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_workspace_id uuid;
begin
  select project.workspace_id
  into target_workspace_id
  from public.projects as project
  where project.id = new.project_id;

  if target_workspace_id is null or not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = new.assignee_id
  ) then
    raise exception 'task assignee must belong to the project workspace' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_task_workspace_assignee() from public, anon, authenticated;

create trigger tasks_require_workspace_assignee
before insert or update of project_id, assignee_id on public.tasks
for each row execute function public.validate_task_workspace_assignee();

create or replace function public.protect_task_first_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.first_completed_at is not null then
    if new.first_completed_at is distinct from old.first_completed_at then
      raise exception 'tasks.first_completed_at is immutable once set' using errcode = '55000';
    end if;

    if new.assignee_id is distinct from old.assignee_id then
      raise exception 'tasks.assignee_id is immutable after first completion' using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;

create index workspace_memberships_user_workspace_idx
  on public.workspace_memberships (user_id, workspace_id);

create index projects_workspace_created_idx
  on public.projects (workspace_id, created_at);

create index tasks_created_by_idx on public.tasks (created_by);
