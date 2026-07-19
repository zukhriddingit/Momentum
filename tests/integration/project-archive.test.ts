import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { getDashboard } from "@/server/dashboard/get-dashboard";
import { selectFocusTask } from "@/server/focus/select-focus-task";
import { archiveProject } from "@/server/projects/archive-project";
import { createProject } from "@/server/projects/create-project";
import { getProjectBoard } from "@/server/projects/get-project-board";
import { updateProject } from "@/server/projects/update-project";
import { completeTask } from "@/server/tasks/complete-task";
import { createTask } from "@/server/tasks/create-task";
import { moveTask } from "@/server/tasks/move-task";
import { updateTask } from "@/server/tasks/update-task";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { getWorkspaceOverview } from "@/server/workspaces/get-workspace-overview";
import { listWorkspaceNavigation } from "@/server/workspaces/list-workspace-navigation";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

const ownerId = selfServiceUuid(1600);
const adminId = selfServiceUuid(1601);
const memberId = selfServiceUuid(1602);
const outsiderId = selfServiceUuid(1603);
const firstWorkday = new Date("2026-07-14T15:00:00.000Z");
const secondWorkday = new Date("2026-07-15T15:00:00.000Z");

let workspaceId: string;

async function loadArchiveArtifactCounts(projectId: string) {
  const [counts] = await database()<
    Array<{
      task_count: number;
      focus_selection_count: number;
      completion_count: number;
      ledger_count: number;
      grant_count: number;
      notification_count: number;
    }>
  >`
    select
      (select count(*)::integer from public.tasks where project_id = ${projectId}) as task_count,
      (
        select count(*)::integer
        from public.focus_selections as focus
        join public.tasks as task on task.id = focus.task_id
        where task.project_id = ${projectId}
      ) as focus_selection_count,
      (select count(*)::integer from public.task_completions where project_id = ${projectId}) as completion_count,
      (select count(*)::integer from public.point_ledger where project_id = ${projectId}) as ledger_count,
      (
        select count(*)::integer
        from public.achievement_grants as achievement
        join public.task_completions as completion
          on completion.id = achievement.completion_id
        where completion.project_id = ${projectId}
      ) as grant_count,
      (select count(*)::integer from public.notifications where project_id = ${projectId}) as notification_count
  `;

  if (!counts) {
    throw new Error("Expected archive artifact counts.");
  }
  return counts;
}

describe("project archive", () => {
  beforeAll(async () => {
    await Promise.all([
      insertAuthUser({
        id: ownerId,
        email: "archive-owner@momentum.local",
        displayName: "Archive Owner",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: adminId,
        email: "archive-admin@momentum.local",
        displayName: "Archive Admin",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: memberId,
        email: "archive-member@momentum.local",
        displayName: "Archive Member",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: outsiderId,
        email: "archive-outsider@momentum.local",
        displayName: "Archive Outsider",
        timezone: "America/New_York",
      }),
    ]);

    const workspace = await createWorkspace({
      actorId: ownerId,
      name: "Archive Workspace",
    });
    workspaceId = workspace.id;
    await database()`
      insert into public.workspace_memberships (workspace_id, user_id, role)
      values
        (${workspaceId}, ${adminId}, 'admin'),
        (${workspaceId}, ${memberId}, 'member')
    `;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("authorizes managers and preserves the first archive timestamp", async () => {
    const ownerProject = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "Owner archive",
      description: null,
    });
    await expect(
      archiveProject({ actorId: ownerId, projectId: ownerProject.id }),
    ).resolves.toMatchObject({
      projectId: ownerProject.id,
      workspaceId,
    });

    const adminProject = await createProject({
      actorId: adminId,
      workspaceId,
      name: "Admin archive",
      description: null,
    });
    const first = await archiveProject({
      actorId: adminId,
      projectId: adminProject.id,
    });
    const retry = await archiveProject({
      actorId: ownerId,
      projectId: adminProject.id,
    });
    expect(retry).toEqual(first);

    const concurrentProject = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "Concurrent archive",
      description: null,
    });
    const concurrent = await Promise.all([
      archiveProject({ actorId: ownerId, projectId: concurrentProject.id }),
      archiveProject({ actorId: adminId, projectId: concurrentProject.id }),
    ]);
    expect(concurrent[0]).toEqual(concurrent[1]);

    const activeProject = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "Protected active project",
      description: null,
    });
    for (const attempt of [
      () => archiveProject({ actorId: memberId, projectId: activeProject.id }),
      () =>
        archiveProject({ actorId: outsiderId, projectId: activeProject.id }),
      () =>
        archiveProject({
          actorId: memberId,
          projectId: selfServiceUuid(1699),
        }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }
  });

  it("removes archived work from active reads and blocks stale mutations", async () => {
    const project = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "History-preserving archive",
      description: "Keep every earned artifact",
    });
    const completedTask = await createTask({
      actorId: ownerId,
      projectId: project.id,
      title: "Completed before archive",
      description: null,
      assignee: { kind: "member", userId: memberId },
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt: firstWorkday,
    });
    await selectFocusTask({
      actorId: memberId,
      taskId: completedTask.taskId,
      occurredAt: firstWorkday,
    });
    await moveTask({
      actorId: memberId,
      taskId: completedTask.taskId,
      status: "in_progress",
      occurredAt: firstWorkday,
    });
    await completeTask({
      actorId: memberId,
      taskId: completedTask.taskId,
      occurredAt: firstWorkday,
    });

    const openTask = await createTask({
      actorId: ownerId,
      projectId: project.id,
      title: "Open at archive time",
      description: null,
      assignee: { kind: "member", userId: memberId },
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt: secondWorkday,
    });
    await selectFocusTask({
      actorId: memberId,
      taskId: openTask.taskId,
      occurredAt: secondWorkday,
    });

    const artifactsBefore = await loadArchiveArtifactCounts(project.id);
    expect(artifactsBefore).toMatchObject({
      task_count: 2,
      focus_selection_count: 2,
      completion_count: 1,
    });
    expect(artifactsBefore.ledger_count).toBeGreaterThan(0);
    expect(artifactsBefore.grant_count).toBeGreaterThan(0);
    expect(artifactsBefore.notification_count).toBeGreaterThan(0);
    await archiveProject({ actorId: ownerId, projectId: project.id });

    expect(
      (await getWorkspaceOverview({ actorId: ownerId, workspaceId })).projects,
    ).not.toContainEqual(expect.objectContaining({ id: project.id }));
    expect(
      (await listWorkspaceNavigation({ actorId: ownerId })).workspaces.flatMap(
        (workspace) => workspace.projects,
      ),
    ).not.toContainEqual(expect.objectContaining({ id: project.id }));

    const dashboard = await getDashboard({
      actorId: memberId,
      occurredAt: secondWorkday,
    });
    expect(dashboard.projects).not.toContainEqual(
      expect.objectContaining({ id: project.id }),
    );
    expect(dashboard.focusTask).toBeNull();
    expect(dashboard.totalPoints).toBeGreaterThan(0);
    expect(dashboard.pointActivity).toContainEqual(
      expect.objectContaining({ taskTitle: "Completed before archive" }),
    );
    expect(dashboard.notification).toEqual(
      expect.objectContaining({ title: expect.any(String) }),
    );

    await expect(
      getProjectBoard({
        actorId: memberId,
        projectId: project.id,
        occurredAt: secondWorkday,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found.",
    });

    expect(await loadArchiveArtifactCounts(project.id)).toEqual(
      artifactsBefore,
    );

    await expect(
      updateProject({
        actorId: ownerId,
        projectId: project.id,
        name: "Stale rename",
        description: null,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Project not found.",
    });
    await expect(
      createTask({
        actorId: ownerId,
        projectId: project.id,
        title: "Stale task",
        description: null,
        assignee: { kind: "member", userId: ownerId },
        effort: "small",
        dueAt: null,
        status: "todo",
        occurredAt: secondWorkday,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Task not found.",
    });

    const staleTaskAttempts = [
      () =>
        updateTask({
          actorId: memberId,
          taskId: openTask.taskId,
          title: "Stale edit",
          description: null,
          assignee: { kind: "member" as const, userId: memberId },
          effort: "small" as const,
          dueAt: null,
          status: "todo" as const,
          occurredAt: secondWorkday,
        }),
      () =>
        moveTask({
          actorId: memberId,
          taskId: openTask.taskId,
          status: "in_progress" as const,
          occurredAt: secondWorkday,
        }),
      () =>
        completeTask({
          actorId: memberId,
          taskId: completedTask.taskId,
          occurredAt: secondWorkday,
        }),
    ];
    for (const attempt of staleTaskAttempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }
    await expect(
      selectFocusTask({
        actorId: memberId,
        taskId: openTask.taskId,
        occurredAt: secondWorkday,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "Only an assigned workspace task can be selected as your Focus Task.",
    });

    expect(await loadArchiveArtifactCounts(project.id)).toEqual(
      artifactsBefore,
    );
  });
});
