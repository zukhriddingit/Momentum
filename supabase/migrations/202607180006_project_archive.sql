alter table public.projects
  add column archived_at timestamptz;

create index projects_active_workspace_created_idx
  on public.projects (workspace_id, created_at, id)
  where archived_at is null;
