begin;

select plan(20);

select has_type('public', 'feedback_category', 'feedback categories are typed');
select has_table('public', 'feedback_submissions', 'feedback submissions exist');
select has_column('public', 'feedback_submissions', 'workspace_id', 'feedback may carry workspace context');
select has_column('public', 'feedback_submissions', 'page_context', 'feedback may carry page context');
select has_index('public', 'feedback_submissions', 'feedback_user_idempotency_idx', 'feedback retries are unique per user');
select has_index('public', 'feedback_submissions', 'feedback_review_created_idx', 'feedback review is indexed by time');
select has_trigger('public', 'feedback_submissions', 'feedback_submissions_are_immutable', 'feedback is append-only');
select has_trigger('public', 'feedback_submissions', 'feedback_workspace_membership_is_valid', 'feedback workspace membership is constrained');

select ok(
  not pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'INSERT')
    and not pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'UPDATE')
    and not pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'DELETE'),
  'authenticated browser cannot mutate feedback'
);

select ok(
  pg_catalog.has_table_privilege('authenticated', 'public.feedback_submissions', 'SELECT'),
  'authenticated browser may select through owner RLS'
);

select policies_are(
  'public',
  'feedback_submissions',
  array['users read their feedback'],
  'feedback has only the owner read policy'
);

select results_eq(
  $$ select enumlabel::text collate "C" from pg_catalog.pg_enum join pg_catalog.pg_type on pg_type.oid = enumtypid where typname = 'feedback_category' order by enumsortorder $$,
  $$ values ('bug'::text collate "C"), ('confusing'::text collate "C"), ('motivation_feedback'::text collate "C"), ('feature_request'::text collate "C"), ('other'::text collate "C") $$,
  'all five feedback categories exist'
);

select col_is_fk('public', 'feedback_submissions', 'user_id', 'feedback user is a foreign key');

insert into public.feedback_submissions (
  id, user_id, workspace_id, page_context, category, rating,
  message, idempotency_key, created_at
) values
  (
    '93000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '/dashboard',
    'confusing',
    4,
    'The focus action could be clearer.',
    '94000000-0000-4000-8000-000000000001',
    '2026-07-16T15:00:00Z'
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '/dashboard',
    'feature_request',
    5,
    'The teammate has separate feedback.',
    '94000000-0000-4000-8000-000000000002',
    '2026-07-16T15:01:00Z'
  );

insert into public.workspaces (id, name, created_by)
values (
  '22000000-0000-4000-8000-000000000001',
  'Teammate private workspace',
  '10000000-0000-4000-8000-000000000002'
);

insert into public.workspace_memberships (workspace_id, user_id, role)
values (
  '22000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'owner'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$ select user_id from public.feedback_submissions order by created_at $$,
  $$ values ('10000000-0000-4000-8000-000000000001'::uuid) $$,
  'RLS exposes only the demo user feedback'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

select results_eq(
  $$ select user_id from public.feedback_submissions order by created_at $$,
  $$ values ('10000000-0000-4000-8000-000000000002'::uuid) $$,
  'RLS exposes only the teammate feedback'
);

reset role;

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, workspace_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'confusing', 4, 'A duplicate retry row is rejected.',
      '94000000-0000-4000-8000-000000000001'
    )
  $$,
  '23505',
  null,
  'a user cannot reuse an idempotency key for another row'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'bug', 0, 'A valid-length feedback message.',
      '94000000-0000-4000-8000-000000000003'
    )
  $$,
  '23514',
  null,
  'rating must be between one and five'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'other', 3, 'short',
      '94000000-0000-4000-8000-000000000004'
    )
  $$,
  '23514',
  null,
  'feedback must contain at least ten trimmed characters'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, page_context, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '/dashboard?token=unsafe', 'other', 3,
      'The page context must be path-only.',
      '94000000-0000-4000-8000-000000000005'
    )
  $$,
  '23514',
  null,
  'page context cannot contain a query string'
);

select throws_ok(
  $$
    insert into public.feedback_submissions (
      user_id, workspace_id, category, rating, message, idempotency_key
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '22000000-0000-4000-8000-000000000001',
      'other', 3, 'Cross-workspace feedback is rejected.',
      '94000000-0000-4000-8000-000000000006'
    )
  $$,
  '23514',
  'feedback workspace requires membership',
  'feedback workspace context requires membership'
);

select * from finish();
rollback;
