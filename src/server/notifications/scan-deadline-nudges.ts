import "server-only";

import { classifyDeadlineEvent } from "@/domain/notifications/classify-deadline-event";
import { selectMotivationMessage } from "@/domain/motivation/select-message";
import type { MotivationTone } from "@/domain/motivation/types";
import { database } from "@/server/db/client";

interface DeadlineTaskRow {
  id: string;
  title: string;
  due_at: Date;
  assignee_id: string;
  project_id: string;
  workspace_id: string;
  motivation_tone: MotivationTone;
}

export interface DeadlineNudgeScanReceipt {
  scannedCount: number;
  createdCount: number;
}

export async function scanDeadlineNudges(input: {
  occurredAt: Date;
}): Promise<DeadlineNudgeScanReceipt> {
  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new TypeError("A valid deadline scan time is required.");
  }

  return database().begin(async (sql) => {
    const tasks = await sql<DeadlineTaskRow[]>`
      select
        task.id,
        task.title,
        task.due_at,
        task.assignee_id,
        project.id as project_id,
        project.workspace_id,
        profile.motivation_tone::text as motivation_tone
      from public.tasks as task
      join public.projects as project on project.id = task.project_id
      join public.profiles as profile on profile.id = task.assignee_id
      join public.motivation_preferences as preference
        on preference.user_id = task.assignee_id
      where task.status <> 'done'
        and task.due_at is not null
        and task.due_at <= ${input.occurredAt} + interval '24 hours'
        and preference.deadline_nudges_enabled
      order by task.due_at, task.id
      for update of task skip locked
    `;
    let createdCount = 0;

    for (const task of tasks) {
      const event = classifyDeadlineEvent({
        now: input.occurredAt,
        dueAt: task.due_at,
      });
      if (!event) {
        continue;
      }

      const message = selectMotivationMessage({
        event,
        tone: task.motivation_tone,
        sourceId: `${task.assignee_id}:${task.id}:${event}:${task.due_at.toISOString()}`,
      });
      const inserted = await sql<Array<{ id: string }>>`
        insert into public.notifications (
          id,
          user_id,
          workspace_id,
          project_id,
          task_id,
          event_type,
          source_id,
          tone,
          template_key,
          title,
          body,
          deadline_at,
          created_at
        ) values (
          ${crypto.randomUUID()},
          ${task.assignee_id},
          ${task.workspace_id},
          ${task.project_id},
          ${task.id},
          ${message.event},
          ${task.id},
          ${message.tone},
          ${message.key},
          ${message.title},
          ${message.body},
          ${task.due_at},
          ${input.occurredAt}
        )
        on conflict do nothing
        returning id
      `;
      if (inserted[0]) {
        createdCount += 1;
      }
    }

    return { scannedCount: tasks.length, createdCount };
  });
}
