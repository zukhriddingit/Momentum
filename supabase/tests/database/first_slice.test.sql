begin;

select plan(12);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'workspaces', 'workspaces exists');
select has_table('public', 'projects', 'projects exists');
select has_table('public', 'tasks', 'tasks exists');
select has_table('public', 'focus_selections', 'focus selections exist');
select has_table('public', 'task_completions', 'completion receipts exist');
select has_table('public', 'point_ledger', 'point ledger exists');
select has_table('public', 'focus_streaks', 'focus streaks exist');
select has_table('public', 'achievement_grants', 'achievement grants exist');
select has_table('public', 'notifications', 'notifications exist');
select has_view('public', 'project_progress', 'project progress view exists');
select has_index(
  'public',
  'point_ledger',
  'point_ledger_completion_id_entry_kind_key',
  'ledger entries are unique per completion and kind'
);

select * from finish();
rollback;
