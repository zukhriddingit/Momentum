create type public.feedback_category as enum (
  'bug',
  'confusing',
  'motivation_feedback',
  'feature_request',
  'other'
);

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  workspace_id uuid references public.workspaces (id),
  page_context text,
  category public.feedback_category not null,
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint feedback_page_context_shape check (
    page_context is null
    or (
      char_length(page_context) between 1 and 200
      and left(page_context, 1) = '/'
      and position('?' in page_context) = 0
      and position('#' in page_context) = 0
    )
  )
);

create unique index feedback_user_idempotency_idx
  on public.feedback_submissions (user_id, idempotency_key);

create index feedback_review_created_idx
  on public.feedback_submissions (created_at desc, id desc);

create index feedback_review_category_idx
  on public.feedback_submissions (category, created_at desc);

create index feedback_review_workspace_idx
  on public.feedback_submissions (workspace_id, created_at desc)
  where workspace_id is not null;

create function public.validate_feedback_workspace_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workspace_id is not null and not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = new.workspace_id
      and membership.user_id = new.user_id
  ) then
    raise exception 'feedback workspace requires membership' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_feedback_workspace_membership()
from public, anon, authenticated;

create trigger feedback_workspace_membership_is_valid
before insert on public.feedback_submissions
for each row execute function public.validate_feedback_workspace_membership();

create trigger feedback_submissions_are_immutable
before update or delete on public.feedback_submissions
for each row execute function public.prevent_immutable_change();

alter table public.feedback_submissions enable row level security;

create policy "users read their feedback"
on public.feedback_submissions for select to authenticated
using (user_id = auth.uid());

grant select on public.feedback_submissions to authenticated;
revoke insert, update, delete on public.feedback_submissions from anon, authenticated;
