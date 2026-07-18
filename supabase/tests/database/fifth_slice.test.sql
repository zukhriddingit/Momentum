begin;

select plan(31);

select has_column('public', 'profiles', 'github_user_id', 'profiles store stable GitHub IDs');
select has_column('public', 'profiles', 'github_handle', 'profiles store normalized GitHub handles');
select has_table('public', 'workspace_cohort_seats', 'workspace cohort seats exist');
select has_column('public', 'tasks', 'cohort_seat_id', 'tasks can reference a pending cohort seat');
select has_trigger('public', 'tasks', 'tasks_require_workspace_assignee', 'task assignment trigger remains installed');
select has_trigger(
  'public',
  'workspace_cohort_seats',
  'workspace_cohort_seat_verified_identity_matches',
  'claimed cohort seats validate their stable GitHub identity'
);

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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'cohort-db-owner@momentum.local',
    extensions.crypt('momentum-test', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Cohort DB Owner","timezone":"America/New_York"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'cohort-db-outsider@momentum.local',
    extensions.crypt('momentum-test', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Cohort DB Outsider","timezone":"UTC"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000103',
    'authenticated',
    'authenticated',
    'cohort-db-github@momentum.local',
    extensions.crypt('momentum-test', extensions.gen_salt('bf')),
    now(),
    '{"provider":"github","providers":["github"]}'::jsonb,
    '{"full_name":"GitHub Cohort Member","user_name":"kperpignant"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

select results_eq(
  $$
    select display_name, timezone, motivation_tone::text
    from public.profiles
    where id = '81000000-0000-4000-8000-000000000103'
  $$,
  $$ values ('GitHub Cohort Member'::text, 'UTC'::text, 'friendly'::text) $$,
  'GitHub auth metadata creates a valid UTC profile without email-signup metadata'
);

select results_eq(
  $$
    select user_id
    from public.motivation_preferences
    where user_id = '81000000-0000-4000-8000-000000000103'
  $$,
  $$ values ('81000000-0000-4000-8000-000000000103'::uuid) $$,
  'GitHub auth initialization creates motivation preferences'
);

select lives_ok(
  $$
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
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '81000000-0000-4000-8000-000000000104',
      'authenticated',
      'authenticated',
      'cohort-db-github-whitespace@momentum.local',
      extensions.crypt('momentum-test', extensions.gen_salt('bf')),
      now(),
      '{"provider":"github","providers":["github"]}'::jsonb,
      '{"full_name":"   ","user_name":"kperpignant"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
  $$,
  'whitespace-only OAuth names fall through to the verified GitHub handle'
);

select results_eq(
  $$
    select display_name, timezone
    from public.profiles
    where id = '81000000-0000-4000-8000-000000000104'
  $$,
  $$ values ('kperpignant'::text, 'UTC'::text) $$,
  'GitHub handle and UTC initialize the profile after a whitespace full name'
);

insert into public.workspaces (id, name, created_by)
values
  (
    '82000000-0000-4000-8000-000000000101',
    'Cohort DB Workspace',
    '81000000-0000-4000-8000-000000000101'
  ),
  (
    '82000000-0000-4000-8000-000000000102',
    'Cohort DB Outsider Workspace',
    '81000000-0000-4000-8000-000000000102'
  );

insert into public.workspace_memberships (workspace_id, user_id, role)
values
  (
    '82000000-0000-4000-8000-000000000101',
    '81000000-0000-4000-8000-000000000101',
    'owner'
  ),
  (
    '82000000-0000-4000-8000-000000000102',
    '81000000-0000-4000-8000-000000000102',
    'owner'
  );

insert into public.projects (id, workspace_id, name, created_by)
values
  (
    '83000000-0000-4000-8000-000000000101',
    '82000000-0000-4000-8000-000000000101',
    'Cohort DB Project',
    '81000000-0000-4000-8000-000000000101'
  ),
  (
    '83000000-0000-4000-8000-000000000102',
    '82000000-0000-4000-8000-000000000102',
    'Cohort DB Outsider Project',
    '81000000-0000-4000-8000-000000000102'
  );

insert into public.workspace_cohort_seats (
  id,
  workspace_id,
  github_user_id,
  github_handle,
  created_by
)
values
  (
    '84000000-0000-4000-8000-000000000101',
    '82000000-0000-4000-8000-000000000101',
    227412781,
    'kperpignant',
    '81000000-0000-4000-8000-000000000101'
  ),
  (
    '84000000-0000-4000-8000-000000000102',
    '82000000-0000-4000-8000-000000000102',
    60740313,
    'zukhriddingit',
    '81000000-0000-4000-8000-000000000102'
  );

select throws_ok(
  $$
    insert into public.workspace_cohort_seats (
      id,
      workspace_id,
      github_user_id,
      github_handle,
      user_id,
      created_by,
      claimed_at
    ) values (
      '84000000-0000-4000-8000-000000000103',
      '82000000-0000-4000-8000-000000000101',
      583231,
      'octocat',
      '81000000-0000-4000-8000-000000000103',
      '81000000-0000-4000-8000-000000000101',
      null
    )
  $$,
  '23514',
  null,
  'claimed seat identity and claimed_at must be set together'
);

select throws_ok(
  $$
    insert into public.tasks (
      id,
      project_id,
      title,
      assignee_id,
      cohort_seat_id,
      status,
      effort,
      created_by
    ) values (
      gen_random_uuid(),
      '83000000-0000-4000-8000-000000000101',
      'Two assignees',
      '81000000-0000-4000-8000-000000000101',
      '84000000-0000-4000-8000-000000000101',
      'todo',
      'small',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23514',
  'task must have exactly one assignee representation',
  'a task cannot reference both an active member and pending seat'
);

select throws_ok(
  $$
    insert into public.tasks (
      id,
      project_id,
      title,
      assignee_id,
      cohort_seat_id,
      status,
      effort,
      created_by
    ) values (
      gen_random_uuid(),
      '83000000-0000-4000-8000-000000000101',
      'No assignee',
      null,
      null,
      'todo',
      'small',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23514',
  'task must have exactly one assignee representation',
  'a task cannot omit both assignee representations'
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
    ) values (
      gen_random_uuid(),
      '83000000-0000-4000-8000-000000000101',
      'Foreign member',
      '81000000-0000-4000-8000-000000000102',
      'todo',
      'small',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23514',
  'task assignee must belong to the project workspace',
  'active assignees must belong to the project workspace'
);

select throws_ok(
  $$
    insert into public.tasks (
      id,
      project_id,
      title,
      cohort_seat_id,
      status,
      effort,
      created_by
    ) values (
      gen_random_uuid(),
      '83000000-0000-4000-8000-000000000101',
      'Foreign pending member',
      '84000000-0000-4000-8000-000000000102',
      'todo',
      'small',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23514',
  'pending task seat must belong to the project workspace',
  'pending assignees must belong to the project workspace'
);

select throws_ok(
  $$
    insert into public.tasks (
      id,
      project_id,
      title,
      assignee_id,
      cohort_seat_id,
      status,
      effort,
      created_by
    ) values (
      gen_random_uuid(),
      '83000000-0000-4000-8000-000000000101',
      'Pending started',
      null,
      '84000000-0000-4000-8000-000000000101',
      'in_progress',
      'small',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23514',
  'pending cohort tasks must remain todo',
  'a pending task cannot start'
);

insert into public.tasks (
  id,
  project_id,
  title,
  cohort_seat_id,
  status,
  effort,
  created_by
)
values (
  '85000000-0000-4000-8000-000000000101',
  '83000000-0000-4000-8000-000000000101',
  'Valid pending task',
  '84000000-0000-4000-8000-000000000101',
  'todo',
  'small',
  '81000000-0000-4000-8000-000000000101'
);

select throws_ok(
  $$
    update public.workspace_cohort_seats
    set
      user_id = '81000000-0000-4000-8000-000000000103',
      claimed_at = now()
    where id = '84000000-0000-4000-8000-000000000101'
  $$,
  '55000',
  'pending tasks must be activated before claiming a cohort seat',
  'a seat cannot be marked claimed while tasks still reference it'
);

insert into public.tasks (
  id,
  project_id,
  title,
  assignee_id,
  status,
  effort,
  first_completed_at,
  created_by
)
values (
  '85000000-0000-4000-8000-000000000102',
  '83000000-0000-4000-8000-000000000101',
  'Completed active task',
  '81000000-0000-4000-8000-000000000101',
  'done',
  'small',
  now(),
  '81000000-0000-4000-8000-000000000101'
);

select throws_ok(
  $$
    update public.tasks
    set
      assignee_id = null,
      cohort_seat_id = '84000000-0000-4000-8000-000000000101'
    where id = '85000000-0000-4000-8000-000000000102'
  $$,
  '55000',
  'tasks.assignee_id is immutable after first completion',
  'a completed task cannot change assignee representation'
);

select throws_ok(
  $$
    insert into public.workspace_cohort_seats (
      id,
      workspace_id,
      github_user_id,
      github_handle,
      created_by
    ) values (
      '84000000-0000-4000-8000-000000000104',
      '82000000-0000-4000-8000-000000000101',
      227412781,
      'kperpignant',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23505',
  null,
  'one workspace has at most one seat for a stable GitHub user'
);

select throws_ok(
  $$
    insert into public.workspace_cohort_seats (
      id,
      workspace_id,
      github_user_id,
      github_handle,
      created_by
    ) values (
      '84000000-0000-4000-8000-000000000105',
      '82000000-0000-4000-8000-000000000101',
      999999999,
      'two--hyphens',
      '81000000-0000-4000-8000-000000000101'
    )
  $$,
  '23514',
  null,
  'seat handles must be normalized valid GitHub handles'
);

update public.profiles
set
  github_user_id = 227412781,
  github_handle = 'kperpignant'
where id = '81000000-0000-4000-8000-000000000103';

select throws_ok(
  $$
    update public.profiles
    set
      github_user_id = 227412781,
      github_handle = 'another-handle'
    where id = '81000000-0000-4000-8000-000000000102'
  $$,
  '23505',
  null,
  'a stable GitHub user can link to only one profile'
);

select throws_ok(
  $$
    insert into public.workspace_cohort_seats (
      id,
      workspace_id,
      github_user_id,
      github_handle,
      user_id,
      created_by,
      claimed_at
    ) values (
      '84000000-0000-4000-8000-000000000106',
      '82000000-0000-4000-8000-000000000101',
      583231,
      'octocat',
      '81000000-0000-4000-8000-000000000103',
      '81000000-0000-4000-8000-000000000101',
      now()
    )
  $$,
  '23514',
  'claimed cohort seat must match the profile GitHub identity',
  'a claimed seat insert must match the profile stable GitHub ID'
);

insert into public.workspace_cohort_seats (
  id,
  workspace_id,
  github_user_id,
  github_handle,
  user_id,
  created_by,
  claimed_at
)
values (
  '84000000-0000-4000-8000-000000000107',
  '82000000-0000-4000-8000-000000000102',
  227412781,
  'kperpignant',
  '81000000-0000-4000-8000-000000000103',
  '81000000-0000-4000-8000-000000000102',
  now()
);

select throws_ok(
  $$
    update public.workspace_cohort_seats
    set
      user_id = '81000000-0000-4000-8000-000000000103',
      claimed_at = now()
    where id = '84000000-0000-4000-8000-000000000102'
  $$,
  '23514',
  'claimed cohort seat must match the profile GitHub identity',
  'a claimed seat update must match the profile stable GitHub ID'
);

select throws_ok(
  $$
    update public.workspace_cohort_seats
    set github_user_id = 583231
    where id = '84000000-0000-4000-8000-000000000107'
  $$,
  '55000',
  'claimed cohort seat identity is immutable',
  'a claimed seat stable GitHub ID is immutable'
);

select throws_ok(
  $$
    update public.workspace_cohort_seats
    set github_handle = 'renamed-member'
    where id = '84000000-0000-4000-8000-000000000107'
  $$,
  '55000',
  'claimed cohort seat identity is immutable',
  'a claimed seat stored GitHub handle is immutable'
);

select throws_ok(
  $$
    update public.workspace_cohort_seats
    set user_id = '81000000-0000-4000-8000-000000000101'
    where id = '84000000-0000-4000-8000-000000000107'
  $$,
  '55000',
  'claimed cohort seat identity is immutable',
  'a claimed seat user is immutable'
);

select throws_ok(
  $$
    update public.workspace_cohort_seats
    set claimed_at = claimed_at + interval '1 second'
    where id = '84000000-0000-4000-8000-000000000107'
  $$,
  '55000',
  'claimed cohort seat identity is immutable',
  'a claimed seat timestamp is immutable'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.workspace_cohort_seats',
    'INSERT,UPDATE,DELETE'
  ),
  'authenticated cannot mutate cohort seats directly'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.validate_cohort_seat_claimed_identity()',
    'EXECUTE'
  )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.validate_cohort_seat_claimed_identity()',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'anon',
      'public.protect_cohort_seat_claim_order()',
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'authenticated',
      'public.protect_cohort_seat_claim_order()',
      'EXECUTE'
    ),
  'browser roles cannot execute cohort-seat trigger helpers'
);

select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000101',
  true
);
set local role authenticated;

select results_eq(
  $$ select github_handle from public.workspace_cohort_seats order by github_handle $$,
  $$ values ('kperpignant'::text) $$,
  'a member can read pending seats in their workspace'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  '81000000-0000-4000-8000-000000000102',
  true
);
set local role authenticated;

select is_empty(
  $$
    select id
    from public.workspace_cohort_seats
    where workspace_id = '82000000-0000-4000-8000-000000000101'
  $$,
  'an outsider cannot read another workspace cohort seats'
);

select * from finish();
rollback;
