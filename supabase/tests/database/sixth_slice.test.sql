begin;

select plan(7);

select has_column(
  'public', 'projects', 'archived_at',
  'projects record an optional archive time'
);
select col_type_is(
  'public', 'projects', 'archived_at', 'timestamp with time zone',
  'project archive time is timezone-aware'
);
select has_index(
  'public', 'projects', 'projects_active_workspace_created_idx',
  'active workspace projects have a partial navigation index'
);
select ok(
  not pg_catalog.has_table_privilege(
    'authenticated', 'public.projects', 'UPDATE'
  ),
  'authenticated browser clients cannot archive projects directly'
);
select lives_ok(
  $$
    update public.projects
    set archived_at = '2026-07-18T20:00:00Z'
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  'the trusted database role can archive a project'
);
select results_eq(
  $$
    select archived_at
    from public.projects
    where id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('2026-07-18T20:00:00Z'::timestamptz) $$,
  'archive time persists exactly'
);
select results_eq(
  $$
    select count(*)::integer
    from public.tasks
    where project_id = '30000000-0000-4000-8000-000000000001'
  $$,
  $$ values (4::integer) $$,
  'archiving preserves related tasks'
);

select * from finish();
rollback;
