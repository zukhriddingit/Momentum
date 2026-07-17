do $$
declare
  demo_user_id constant uuid := '10000000-0000-4000-8000-000000000001';
  teammate_user_id constant uuid := '10000000-0000-4000-8000-000000000002';
  workspace_id constant uuid := '20000000-0000-4000-8000-000000000001';
  project_id constant uuid := '30000000-0000-4000-8000-000000000001';
  candidate_task_id constant uuid := '40000000-0000-4000-8000-000000000001';
  due_soon_task_id constant uuid := '40000000-0000-4000-8000-000000000002';
  first_history_task_id constant uuid := '40000000-0000-4000-8000-000000000003';
  second_history_task_id constant uuid := '40000000-0000-4000-8000-000000000004';
  first_focus_id constant uuid := '50000000-0000-4000-8000-000000000001';
  second_focus_id constant uuid := '50000000-0000-4000-8000-000000000002';
  first_completion_id constant uuid := '60000000-0000-4000-8000-000000000001';
  second_completion_id constant uuid := '60000000-0000-4000-8000-000000000002';
  demo_work_date date;
  first_work_date date;
  second_work_date date;
  demo_now timestamptz;
  first_completed_at timestamptz;
  second_completed_at timestamptz;
begin
  demo_work_date := (now() at time zone 'America/New_York')::date;
  if extract(isodow from demo_work_date) = 6 then
    demo_work_date := demo_work_date + 2;
  elsif extract(isodow from demo_work_date) = 7 then
    demo_work_date := demo_work_date + 1;
  end if;

  second_work_date := demo_work_date - 1;
  while extract(isodow from second_work_date) > 5 loop
    second_work_date := second_work_date - 1;
  end loop;

  first_work_date := second_work_date - 1;
  while extract(isodow from first_work_date) > 5 loop
    first_work_date := first_work_date - 1;
  end loop;

  demo_now := (demo_work_date::timestamp + time '12:00') at time zone 'America/New_York';
  first_completed_at := (first_work_date::timestamp + time '16:00') at time zone 'America/New_York';
  second_completed_at := (second_work_date::timestamp + time '16:00') at time zone 'America/New_York';

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
      demo_user_id,
      'authenticated',
      'authenticated',
      'demo@momentum.local',
      extensions.crypt('momentum-demo', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Maya Chen","timezone":"America/New_York"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      teammate_user_id,
      'authenticated',
      'authenticated',
      'teammate@momentum.local',
      extensions.crypt('momentum-demo', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Alex Rivera","timezone":"America/New_York"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

  insert into auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      '11000000-0000-4000-8000-000000000001',
      demo_user_id::text,
      demo_user_id,
      jsonb_build_object(
        'sub', demo_user_id::text,
        'email', 'demo@momentum.local',
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    ),
    (
      '11000000-0000-4000-8000-000000000002',
      teammate_user_id::text,
      teammate_user_id,
      jsonb_build_object(
        'sub', teammate_user_id::text,
        'email', 'teammate@momentum.local',
        'email_verified', true
      ),
      'email',
      now(),
      now(),
      now()
    );

  insert into public.profiles (id, display_name, timezone, motivation_tone)
  values
    (demo_user_id, 'Maya Chen', 'America/New_York', 'friendly'),
    (teammate_user_id, 'Alex Rivera', 'America/New_York', 'friendly')
  on conflict (id) do nothing;

  insert into public.workspaces (id, name, created_by)
  values (workspace_id, 'Momentum Demo Team', demo_user_id);

  insert into public.workspace_memberships (workspace_id, user_id, role)
  values
    (workspace_id, demo_user_id, 'owner'),
    (workspace_id, teammate_user_id, 'member');

  insert into public.projects (id, workspace_id, name, description, created_by)
  values (
    project_id,
    workspace_id,
    'Launch Week',
    'A focused demonstration project for the Momentum happy path.',
    demo_user_id
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
  values
    (
      candidate_task_id,
      project_id,
      'Prepare launch brief',
      'Turn the launch goals into a clear one-page brief for the team.',
      demo_user_id,
      'todo',
      'medium',
      demo_now + interval '10 days',
      null,
      demo_user_id
    ),
    (
      due_soon_task_id,
      project_id,
      'Review onboarding copy',
      'Give the onboarding flow a supportive, concise copy pass.',
      demo_user_id,
      'in_progress',
      'small',
      demo_now + interval '12 hours',
      null,
      demo_user_id
    ),
    (
      first_history_task_id,
      project_id,
      'Outline launch goals',
      null,
      demo_user_id,
      'done',
      'small',
      null,
      first_completed_at,
      demo_user_id
    ),
    (
      second_history_task_id,
      project_id,
      'Collect customer quotes',
      null,
      demo_user_id,
      'done',
      'small',
      null,
      second_completed_at,
      demo_user_id
    );

  insert into public.focus_selections (
    id,
    user_id,
    task_id,
    work_date,
    selected_at,
    completed_at
  )
  values
    (
      first_focus_id,
      demo_user_id,
      first_history_task_id,
      first_work_date,
      first_completed_at - interval '3 hours',
      first_completed_at
    ),
    (
      second_focus_id,
      demo_user_id,
      second_history_task_id,
      second_work_date,
      second_completed_at - interval '3 hours',
      second_completed_at
    );

  insert into public.focus_streaks (
    user_id,
    current_count,
    longest_count,
    last_completed_work_date
  )
  values (demo_user_id, 2, 2, second_work_date);

  insert into public.task_completions (
    id,
    task_id,
    workspace_id,
    project_id,
    recipient_id,
    actor_id,
    focus_selection_id,
    completed_at,
    base_points,
    timing_multiplier,
    streak_multiplier,
    pre_completion_streak,
    post_completion_streak,
    final_points,
    task_title,
    message_event,
    message_tone,
    message_template_key,
    message_title,
    message_body
  )
  values
    (
      first_completion_id,
      first_history_task_id,
      workspace_id,
      project_id,
      demo_user_id,
      demo_user_id,
      first_focus_id,
      first_completed_at,
      20,
      1,
      1,
      0,
      1,
      20,
      'Outline launch goals',
      'focus_task_completed',
      'friendly',
      'seed-history-v1',
      'Focus task complete',
      'A focused step moved the project forward.'
    ),
    (
      second_completion_id,
      second_history_task_id,
      workspace_id,
      project_id,
      demo_user_id,
      demo_user_id,
      second_focus_id,
      second_completed_at,
      20,
      1,
      1.04,
      1,
      2,
      21,
      'Collect customer quotes',
      'focus_task_completed',
      'friendly',
      'seed-history-v1',
      'Focus task complete',
      'A focused step moved the project forward.'
    );

  insert into public.achievement_grants (
    id,
    user_id,
    achievement_code,
    completion_id,
    granted_at
  )
  values
    (
      '80000000-0000-4000-8000-000000000001',
      demo_user_id,
      'first_step',
      first_completion_id,
      first_completed_at
    ),
    (
      '80000000-0000-4000-8000-000000000002',
      demo_user_id,
      'focused_finish',
      first_completion_id,
      first_completed_at
    );

  insert into public.point_ledger (
    id,
    completion_id,
    workspace_id,
    project_id,
    user_id,
    entry_kind,
    points,
    created_at
  )
  values
    (
      '70000000-0000-4000-8000-000000000001',
      first_completion_id,
      workspace_id,
      project_id,
      demo_user_id,
      'base',
      20,
      first_completed_at
    ),
    (
      '70000000-0000-4000-8000-000000000002',
      second_completion_id,
      workspace_id,
      project_id,
      demo_user_id,
      'base',
      20,
      second_completed_at
    ),
    (
      '70000000-0000-4000-8000-000000000003',
      second_completion_id,
      workspace_id,
      project_id,
      demo_user_id,
      'streak_bonus',
      1,
      second_completed_at
    );

  insert into public.notifications (
    id, user_id, workspace_id, project_id, task_id, event_type,
    source_id, tone, template_key, title, body, read_at, created_at
  ) values (
    '90000000-0000-4000-8000-000000000001',
    demo_user_id,
    workspace_id,
    project_id,
    second_history_task_id,
    'focus_task_completed',
    second_completion_id,
    'friendly',
    'seed-history-v1',
    'Focus task complete',
    'A focused step moved the project forward.',
    second_completed_at,
    second_completed_at
  );
end;
$$;
