begin;

select plan(20);

select has_function(
  'public',
  'initialize_auth_profile',
  array[]::text[],
  'profile trigger function exists'
);
select has_trigger(
  'auth',
  'users',
  'initialize_auth_profile_after_insert',
  'auth insert initializes a profile'
);
select has_function(
  'public',
  'validate_task_workspace_assignee',
  array[]::text[],
  'task assignee validator exists'
);
select has_trigger(
  'public',
  'tasks',
  'tasks_require_workspace_assignee',
  'tasks enforce same-workspace assignees'
);
select has_index(
  'public',
  'workspace_memberships',
  'workspace_memberships_user_workspace_idx',
  'membership navigation index exists'
);
select has_index(
  'public',
  'projects',
  'projects_workspace_created_idx',
  'workspace project index exists'
);
select has_index(
  'public',
  'tasks',
  'tasks_created_by_idx',
  'task creator permission index exists'
);
select function_returns(
  'public',
  'protect_task_first_completion',
  array[]::text[],
  'trigger',
  'task completion guard remains a trigger'
);

select ok(
  not bool_or(
    pg_catalog.has_table_privilege(
      test_role.role_name,
      format('public.%I', trusted_relation.relation_name),
      tested_privilege.privilege_name
    )
  ),
  format(
    '%s cannot %s trusted reward tables',
    test_role.role_name,
    tested_privilege.privilege_name
  )
)
from (
  values ('authenticated'), ('anon')
) as test_role(role_name)
cross join (
  values ('INSERT'), ('UPDATE'), ('DELETE')
) as tested_privilege(privilege_name)
cross join (
  values
    ('task_completions'),
    ('point_ledger'),
    ('focus_streaks'),
    ('achievement_grants'),
    ('notifications')
) as trusted_relation(relation_name)
group by test_role.role_name, tested_privilege.privilege_name
order by test_role.role_name, tested_privilege.privilege_name;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000100',
  'authenticated',
  'authenticated',
  'database-test@momentum.local',
  extensions.crypt('momentum-test', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Database Test Member","timezone":"America/Los_Angeles"}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

select lives_ok(
  $$
    insert into public.profiles (id, display_name, timezone, motivation_tone)
    values (
      '10000000-0000-4000-8000-000000000100',
      'Seed Fallback Name',
      'UTC',
      'minimal'
    )
    on conflict (id) do nothing
  $$,
  'explicit profile seeding is conflict-safe after the auth trigger'
);

select results_eq(
  $$
    select display_name, timezone, motivation_tone::text
    from public.profiles
    where id = '10000000-0000-4000-8000-000000000100'
  $$,
  $$
    values (
      'Database Test Member'::text,
      'America/Los_Angeles'::text,
      'friendly'::text
    )
  $$,
  'auth insert creates exactly one friendly profile with the requested valid timezone'
);

insert into public.workspaces (id, name, created_by)
values (
  '20000000-0000-4000-8000-000000000100',
  'Database Test Workspace',
  '10000000-0000-4000-8000-000000000100'
);

insert into public.workspace_memberships (workspace_id, user_id, role)
values (
  '20000000-0000-4000-8000-000000000100',
  '10000000-0000-4000-8000-000000000100',
  'owner'
);

insert into public.projects (id, workspace_id, name, description, created_by)
values (
  '30000000-0000-4000-8000-000000000100',
  '20000000-0000-4000-8000-000000000100',
  'Database Test Project',
  null,
  '10000000-0000-4000-8000-000000000100'
);

insert into public.tasks (
  id,
  project_id,
  title,
  description,
  assignee_id,
  status,
  effort,
  due_at,
  first_completed_at,
  created_by
)
values (
  '40000000-0000-4000-8000-000000000100',
  '30000000-0000-4000-8000-000000000100',
  'Database Test Task',
  null,
  '10000000-0000-4000-8000-000000000100',
  'todo',
  'small',
  null,
  null,
  '10000000-0000-4000-8000-000000000100'
);

select throws_ok(
  $$
    insert into public.tasks (
      id,
      project_id,
      title,
      assignee_id,
      status,
      effort,
      created_by
    )
    values (
      '40000000-0000-4000-8000-000000000101',
      '30000000-0000-4000-8000-000000000001',
      'Invalid cross-workspace assignment',
      '10000000-0000-4000-8000-000000000100',
      'todo',
      'small',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  '23514',
  'task assignee must belong to the project workspace',
  'task assignment rejects users from another workspace'
);

select throws_ok(
  $$
    update public.tasks
    set assignee_id = '10000000-0000-4000-8000-000000000002'
    where id = '40000000-0000-4000-8000-000000000003'
  $$,
  '55000',
  'tasks.assignee_id is immutable after first completion',
  'a first-completed task cannot change assignee'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000100',
  true
);
set local role authenticated;

select is_empty(
  $$
    select leaked_resource
    from (
      select 'profile'::text as leaked_resource
      from public.profiles
      where id = '10000000-0000-4000-8000-000000000001'
      union all
      select 'workspace'
      from public.workspaces
      where id = '20000000-0000-4000-8000-000000000001'
      union all
      select 'membership'
      from public.workspace_memberships
      where workspace_id = '20000000-0000-4000-8000-000000000001'
      union all
      select 'project'
      from public.projects
      where id = '30000000-0000-4000-8000-000000000001'
      union all
      select 'task'
      from public.tasks
      where project_id = '30000000-0000-4000-8000-000000000001'
    ) as tenant_leaks
  $$,
  'authenticated tenant reads cannot expose another workspace'
);

select results_eq(
  $$
    select visible_resource
    from (
      select 'profile'::text as visible_resource
      from public.profiles
      where id = '10000000-0000-4000-8000-000000000100'
      union all
      select 'workspace'
      from public.workspaces
      where id = '20000000-0000-4000-8000-000000000100'
      union all
      select 'membership'
      from public.workspace_memberships
      where workspace_id = '20000000-0000-4000-8000-000000000100'
      union all
      select 'project'
      from public.projects
      where id = '30000000-0000-4000-8000-000000000100'
      union all
      select 'task'
      from public.tasks
      where project_id = '30000000-0000-4000-8000-000000000100'
    ) as tenant_resources
    order by visible_resource
  $$,
  $$
    values
      ('membership'::text),
      ('profile'::text),
      ('project'::text),
      ('task'::text),
      ('workspace'::text)
  $$,
  'authenticated tenant reads retain access to their own workspace'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();
rollback;
