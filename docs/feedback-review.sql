-- Run only from an authorized operator database session. This internal review
-- intentionally omits authentication email addresses.

select
  feedback.id,
  feedback.created_at,
  feedback.category,
  feedback.rating,
  feedback.workspace_id,
  workspace.name as workspace_name,
  feedback.page_context,
  feedback.message
from public.feedback_submissions as feedback
left join public.workspaces as workspace on workspace.id = feedback.workspace_id
where feedback.created_at >= :'since'::timestamptz
order by feedback.created_at desc, feedback.id desc
limit 200;
