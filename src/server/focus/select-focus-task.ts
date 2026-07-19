import "server-only";

import { isWeekday, toWorkDate } from "@/domain/streaks/work-date";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";
import type { FocusSelectionView } from "@/server/types";

interface FocusTaskAuthorizationRow {
  task_id: string;
  timezone: string;
}

interface ExistingFocusRow {
  id: string;
  task_id: string;
  completed_at: Date | null;
}

export async function selectFocusTask(input: {
  actorId: string;
  taskId: string;
  occurredAt: Date;
}): Promise<FocusSelectionView> {
  return database().begin(async (sql) => {
    const authorizedRows = await sql<FocusTaskAuthorizationRow[]>`
      select task.id as task_id, profile.timezone
      from public.tasks as task
      join public.projects as project on project.id = task.project_id
      join public.workspace_memberships as membership
        on membership.workspace_id = project.workspace_id
        and membership.user_id = ${input.actorId}
      join public.profiles as profile on profile.id = ${input.actorId}
      where task.id = ${input.taskId}
        and task.assignee_id = ${input.actorId}
        and project.archived_at is null
      for update of task, project
    `;
    const authorized = authorizedRows[0];
    if (!authorized) {
      throw new AppError(
        "FORBIDDEN",
        "Only an assigned workspace task can be selected as your Focus Task.",
      );
    }

    const workDate = toWorkDate(input.occurredAt, authorized.timezone);
    if (!isWeekday(workDate)) {
      throw new AppError(
        "CONFLICT",
        "Focus Tasks are selected on workdays; weekends leave your streak unchanged.",
      );
    }

    const existingRows = await sql<ExistingFocusRow[]>`
      select id, task_id, completed_at
      from public.focus_selections
      where user_id = ${input.actorId}
        and work_date = ${workDate}
      for update
    `;
    const existing = existingRows[0];
    if (existing?.completed_at) {
      throw new AppError(
        "CONFLICT",
        "Today's completed Focus Task cannot be changed.",
      );
    }

    if (existing) {
      await sql`
        update public.focus_selections
        set task_id = ${input.taskId}, selected_at = ${input.occurredAt}
        where id = ${existing.id}
      `;
      return { id: existing.id, taskId: input.taskId, workDate };
    }

    const id = crypto.randomUUID();
    await sql`
      insert into public.focus_selections (
        id, user_id, task_id, work_date, selected_at
      ) values (
        ${id}, ${input.actorId}, ${input.taskId}, ${workDate}, ${input.occurredAt}
      )
    `;
    return { id, taskId: input.taskId, workDate };
  });
}
