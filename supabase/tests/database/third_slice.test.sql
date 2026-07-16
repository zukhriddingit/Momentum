begin;

select plan(20);

select has_type('public', 'motivation_event_type', 'motivation events are typed');
select has_table('public', 'motivation_preferences', 'motivation preferences exist');
select has_column('public', 'task_completions', 'task_title', 'completion stores task title');
select has_column('public', 'task_completions', 'message_event', 'completion stores message event');
select has_column('public', 'task_completions', 'message_tone', 'completion stores message tone');
select has_column('public', 'notifications', 'project_id', 'notifications route to projects');
select has_column('public', 'notifications', 'task_id', 'notifications route to tasks');
select has_column('public', 'notifications', 'deadline_at', 'notifications snapshot exact deadline');
select has_index('public', 'notifications', 'notifications_user_history_idx', 'notification history is indexed');
select has_index('public', 'notifications', 'notifications_user_unread_idx', 'unread notifications are indexed');
select has_index('public', 'notifications', 'notifications_completion_identity_idx', 'completion notification identity is unique');
select has_index('public', 'notifications', 'notifications_deadline_identity_idx', 'deadline notification identity is unique');
select has_index('public', 'tasks', 'tasks_open_deadline_idx', 'deadline scans are indexed');
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as relation
      on relation.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'notifications'
      and constraint_record.conname = 'notifications_deadline_shape'
      and constraint_record.contype = 'c'
  ),
  'deadline notification shape is constrained'
);

select results_eq(
  $$ select code from public.achievement_definitions order by code $$,
  $$ values
    ('ahead_of_schedule'::text),
    ('first_step'::text),
    ('five_day_flow'::text),
    ('focused_finish'::text),
    ('momentum_three'::text) $$,
  'all five achievements are seeded'
);

select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.motivation_preferences', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.motivation_preferences', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.motivation_preferences', 'DELETE'),
  'authenticated browser cannot write motivation preferences'
);
select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.notifications', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.notifications', 'DELETE'),
  'authenticated browser cannot write generated notifications'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'motivation_preferences'
      and policyname = 'users read their motivation preferences'
  ),
  'preferences have owner read RLS'
);
select has_trigger('public', 'notifications', 'notification_content_is_immutable', 'notification content is protected');
select has_trigger('auth', 'users', 'initialize_auth_profile_after_insert', 'auth initialization remains installed');

select * from finish();
rollback;
