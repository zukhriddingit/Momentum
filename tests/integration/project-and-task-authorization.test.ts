import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { createProject } from "@/server/projects/create-project";
import { updateProject } from "@/server/projects/update-project";
import { createTask } from "@/server/tasks/create-task";
import { moveTask } from "@/server/tasks/move-task";
import { updateTask } from "@/server/tasks/update-task";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { getWorkspaceOverview } from "@/server/workspaces/get-workspace-overview";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

const ownerId = selfServiceUuid(100);
const adminId = selfServiceUuid(101);
const memberId = selfServiceUuid(102);
const outsiderId = selfServiceUuid(103);
const taskOwnerId = selfServiceUuid(200);
const taskAdminId = selfServiceUuid(201);
const taskCreatorId = selfServiceUuid(202);
const taskAssigneeId = selfServiceUuid(203);
const taskReplacementId = selfServiceUuid(204);
const taskOtherMemberId = selfServiceUuid(205);
const taskOutsiderId = selfServiceUuid(206);

let workspaceId: string;
let outsiderWorkspaceId: string;

describe("project authorization", () => {
  beforeAll(async () => {
    await Promise.all([
      insertAuthUser({
        id: ownerId,
        email: "project-owner@momentum.local",
        displayName: "Project Owner",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: adminId,
        email: "project-admin@momentum.local",
        displayName: "Project Admin",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: memberId,
        email: "project-member@momentum.local",
        displayName: "Project Member",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: outsiderId,
        email: "project-outsider@momentum.local",
        displayName: "Project Outsider",
        timezone: "America/New_York",
      }),
    ]);

    const [workspace, outsiderWorkspace] = await Promise.all([
      createWorkspace({ actorId: ownerId, name: "Project Workspace" }),
      createWorkspace({ actorId: outsiderId, name: "Outsider Workspace" }),
    ]);
    workspaceId = workspace.id;
    outsiderWorkspaceId = outsiderWorkspace.id;

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

  it("allows owners and admins to create and update projects", async () => {
    const ownerProject = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "Owner Project",
      description: null,
    });
    const adminProject = await createProject({
      actorId: adminId,
      workspaceId,
      name: "Admin Project",
      description: "Created by an admin",
    });

    expect(ownerProject).toMatchObject({
      workspaceId,
      name: "Owner Project",
      description: null,
    });
    expect(adminProject).toMatchObject({
      workspaceId,
      name: "Admin Project",
      description: "Created by an admin",
    });

    await expect(
      updateProject({
        actorId: adminId,
        projectId: ownerProject.id,
        name: "Admin Updated Project",
        description: "Shared stewardship",
      }),
    ).resolves.toMatchObject({
      id: ownerProject.id,
      workspaceId,
      name: "Admin Updated Project",
      description: "Shared stewardship",
    });
    await expect(
      updateProject({
        actorId: ownerId,
        projectId: adminProject.id,
        name: "Owner Updated Project",
        description: null,
      }),
    ).resolves.toMatchObject({
      id: adminProject.id,
      workspaceId,
      name: "Owner Updated Project",
      description: null,
    });
  });

  it("returns accessible project progress for a workspace member", async () => {
    const project = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "Progress Project",
      description: "A visible outcome",
    });

    await database()`
      insert into public.tasks (
        id,
        project_id,
        title,
        assignee_id,
        status,
        effort,
        created_by
      )
      values
        (
          ${selfServiceUuid(150)},
          ${project.id},
          'Completed task',
          ${memberId},
          'done',
          'small',
          ${ownerId}
        ),
        (
          ${selfServiceUuid(151)},
          ${project.id},
          'Next task',
          ${memberId},
          'todo',
          'medium',
          ${ownerId}
        )
    `;

    const overview = await getWorkspaceOverview({
      actorId: memberId,
      workspaceId,
    });

    expect(overview).toMatchObject({
      id: workspaceId,
      name: "Project Workspace",
      actorRole: "member",
    });
    expect(overview.projects.find((item) => item.id === project.id)).toEqual({
      id: project.id,
      workspaceId,
      name: "Progress Project",
      description: "A visible outcome",
      doneTasks: 1,
      totalTasks: 2,
      percentComplete: 50,
    });
  });

  it("makes outsider and missing workspace overviews indistinguishable", async () => {
    const attempts = [
      () => getWorkspaceOverview({ actorId: outsiderId, workspaceId }),
      () =>
        getWorkspaceOverview({
          actorId: ownerId,
          workspaceId: selfServiceUuid(197),
        }),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }
  });

  it("makes forbidden and missing workspaces indistinguishable on create", async () => {
    const attempts = [
      () =>
        createProject({
          actorId: memberId,
          workspaceId,
          name: "Denied Member Project",
          description: null,
        }),
      () =>
        createProject({
          actorId: memberId,
          workspaceId: outsiderWorkspaceId,
          name: "Denied Cross-workspace Project",
          description: null,
        }),
      () =>
        createProject({
          actorId: memberId,
          workspaceId: selfServiceUuid(199),
          name: "Missing Workspace Project",
          description: null,
        }),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }
  });

  it("makes forbidden and missing projects indistinguishable on update", async () => {
    const project = await createProject({
      actorId: ownerId,
      workspaceId,
      name: "Protected Project",
      description: null,
    });
    const outsiderProject = await createProject({
      actorId: outsiderId,
      workspaceId: outsiderWorkspaceId,
      name: "Outsider Project",
      description: null,
    });

    const attempts = [
      () =>
        updateProject({
          actorId: memberId,
          projectId: project.id,
          name: "Denied Member Update",
          description: null,
        }),
      () =>
        updateProject({
          actorId: memberId,
          projectId: outsiderProject.id,
          name: "Denied Cross-workspace Update",
          description: null,
        }),
      () =>
        updateProject({
          actorId: memberId,
          projectId: selfServiceUuid(198),
          name: "Missing Project Update",
          description: null,
        }),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Project not found.",
      });
    }
  });
});

describe("task authorization and atomic completion delegation", () => {
  const occurredAt = new Date("2026-07-15T15:00:00.000Z");
  let taskWorkspaceId: string;
  let taskOutsiderWorkspaceId: string;
  let taskProjectId: string;

  beforeAll(async () => {
    await Promise.all([
      insertAuthUser({
        id: taskOwnerId,
        email: "task-owner@momentum.local",
        displayName: "Task Owner",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: taskAdminId,
        email: "task-admin@momentum.local",
        displayName: "Task Admin",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: taskCreatorId,
        email: "task-creator@momentum.local",
        displayName: "Task Creator",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: taskAssigneeId,
        email: "task-assignee@momentum.local",
        displayName: "Task Assignee",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: taskReplacementId,
        email: "task-replacement@momentum.local",
        displayName: "Task Replacement",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: taskOtherMemberId,
        email: "task-other@momentum.local",
        displayName: "Task Other Member",
        timezone: "America/New_York",
      }),
      insertAuthUser({
        id: taskOutsiderId,
        email: "task-outsider@momentum.local",
        displayName: "Task Outsider",
        timezone: "America/New_York",
      }),
    ]);

    const [workspace, outsiderWorkspace] = await Promise.all([
      createWorkspace({ actorId: taskOwnerId, name: "Task Workspace" }),
      createWorkspace({
        actorId: taskOutsiderId,
        name: "Task Outsider Workspace",
      }),
    ]);
    taskWorkspaceId = workspace.id;
    taskOutsiderWorkspaceId = outsiderWorkspace.id;

    await database()`
      insert into public.workspace_memberships (workspace_id, user_id, role)
      values
        (${taskWorkspaceId}, ${taskAdminId}, 'admin'),
        (${taskWorkspaceId}, ${taskCreatorId}, 'member'),
        (${taskWorkspaceId}, ${taskAssigneeId}, 'member'),
        (${taskWorkspaceId}, ${taskReplacementId}, 'member'),
        (${taskWorkspaceId}, ${taskOtherMemberId}, 'member')
    `;

    const project = await createProject({
      actorId: taskOwnerId,
      workspaceId: taskWorkspaceId,
      name: "Task Service Project",
      description: null,
    });
    taskProjectId = project.id;
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("lets a member create a task and derives trusted fields on the server", async () => {
    const receipt = await createTask({
      actorId: taskCreatorId,
      projectId: taskProjectId,
      title: "Prepare the launch notes",
      description: null,
      assigneeId: taskAssigneeId,
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt,
    });

    expect(receipt).toEqual({
      taskId: expect.any(String),
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
      completion: null,
    });

    const [task] = await database()<
      Array<{
        created_by: string;
        assignee_id: string;
        status: string;
        first_completed_at: Date | null;
      }>
    >`
      select created_by, assignee_id, status::text, first_completed_at
      from public.tasks
      where id = ${receipt.taskId}
    `;
    expect(task).toEqual({
      created_by: taskCreatorId,
      assignee_id: taskAssigneeId,
      status: "todo",
      first_completed_at: null,
    });
  });

  it("lets owners, admins, and creators edit while limiting an assignee-only member to status", async () => {
    const created = await createTask({
      actorId: taskCreatorId,
      projectId: taskProjectId,
      title: "Draft the customer update",
      description: null,
      assigneeId: taskAssigneeId,
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt,
    });

    await expect(
      updateTask({
        actorId: taskOwnerId,
        taskId: created.taskId,
        title: "Draft the customer update",
        description: "Owner clarified the goal",
        assigneeId: taskAssigneeId,
        effort: "medium",
        dueAt: null,
        status: "todo",
        occurredAt,
      }),
    ).resolves.toMatchObject({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
    });

    await expect(
      updateTask({
        actorId: taskAdminId,
        taskId: created.taskId,
        title: "Draft the customer update",
        description: "Admin clarified the goal",
        assigneeId: taskAssigneeId,
        effort: "medium",
        dueAt: null,
        status: "todo",
        occurredAt,
      }),
    ).resolves.toMatchObject({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
    });

    await expect(
      updateTask({
        actorId: taskCreatorId,
        taskId: created.taskId,
        title: "Write the customer update",
        description: "Admin clarified the goal",
        assigneeId: taskAssigneeId,
        effort: "medium",
        dueAt: null,
        status: "todo",
        occurredAt,
      }),
    ).resolves.toMatchObject({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
    });

    await expect(
      updateTask({
        actorId: taskAssigneeId,
        taskId: created.taskId,
        title: "Write the customer update",
        description: "Admin clarified the goal",
        assigneeId: taskAssigneeId,
        effort: "medium",
        dueAt: null,
        status: "in_progress",
        occurredAt,
      }),
    ).resolves.toEqual({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "in_progress",
      completion: null,
    });

    await expect(
      moveTask({
        actorId: taskAssigneeId,
        taskId: created.taskId,
        status: "todo",
        occurredAt,
      }),
    ).resolves.toEqual({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
      completion: null,
    });

    await expect(
      moveTask({
        actorId: taskAssigneeId,
        taskId: created.taskId,
        status: "todo",
        occurredAt,
      }),
    ).resolves.toEqual({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
      completion: null,
    });

    await expect(
      updateTask({
        actorId: taskAssigneeId,
        taskId: created.taskId,
        title: "Assignee rewrote the title",
        description: "Admin clarified the goal",
        assigneeId: taskAssigneeId,
        effort: "medium",
        dueAt: null,
        status: "todo",
        occurredAt,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Task not found.",
    });
  });

  it("allows reassignment before completion and rejects cross-workspace assignees", async () => {
    const created = await createTask({
      actorId: taskCreatorId,
      projectId: taskProjectId,
      title: "Pair on the release checklist",
      description: null,
      assigneeId: taskAssigneeId,
      effort: "medium",
      dueAt: null,
      status: "todo",
      occurredAt,
    });

    await expect(
      updateTask({
        actorId: taskCreatorId,
        taskId: created.taskId,
        title: "Pair on the release checklist",
        description: null,
        assigneeId: taskReplacementId,
        effort: "medium",
        dueAt: null,
        status: "todo",
        occurredAt,
      }),
    ).resolves.toEqual({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "todo",
      completion: null,
    });

    const forbiddenInputs = [
      () =>
        createTask({
          actorId: taskCreatorId,
          projectId: taskProjectId,
          title: "Cross-workspace create",
          description: null,
          assigneeId: taskOutsiderId,
          effort: "small" as const,
          dueAt: null,
          status: "todo" as const,
          occurredAt,
        }),
      () =>
        updateTask({
          actorId: taskCreatorId,
          taskId: created.taskId,
          title: "Pair on the release checklist",
          description: null,
          assigneeId: taskOutsiderId,
          effort: "medium" as const,
          dueAt: null,
          status: "todo" as const,
          occurredAt,
        }),
    ];

    for (const attempt of forbiddenInputs) {
      await expect(attempt()).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }

    expect(taskOutsiderWorkspaceId).not.toBe(taskWorkspaceId);
  });

  it("requires the assignee for Done even when the actor can edit", async () => {
    const created = await createTask({
      actorId: taskCreatorId,
      projectId: taskProjectId,
      title: "Finish the assigned follow-up",
      description: null,
      assigneeId: taskAssigneeId,
      effort: "small",
      dueAt: null,
      status: "todo",
      occurredAt,
    });

    for (const actorId of [
      taskOwnerId,
      taskAdminId,
      taskCreatorId,
      taskOtherMemberId,
    ]) {
      await expect(
        updateTask({
          actorId,
          taskId: created.taskId,
          title: "Finish the assigned follow-up",
          description: null,
          assigneeId: taskAssigneeId,
          effort: "small",
          dueAt: null,
          status: "done",
          occurredAt,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Task not found.",
      });
    }
  });

  it("delegates edit-to-Done atomically and freezes the completed assignee", async () => {
    const created = await createTask({
      actorId: taskAssigneeId,
      projectId: taskProjectId,
      title: "Complete a medium task",
      description: null,
      assigneeId: taskAssigneeId,
      effort: "medium",
      dueAt: null,
      status: "todo",
      occurredAt,
    });

    const result = await updateTask({
      actorId: taskAssigneeId,
      taskId: created.taskId,
      title: "Complete a medium task",
      description: "Finished with care",
      assigneeId: taskAssigneeId,
      effort: "medium",
      dueAt: null,
      status: "done",
      occurredAt,
    });
    expect(result).toMatchObject({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      completion: {
        wasNewCompletion: true,
        points: { finalPoints: 40 },
      },
    });
    if (!result.completion) {
      throw new Error("Expected edit-to-Done to return a completion receipt.");
    }

    const [artifacts] = await database()<
      Array<{ completions: number; points: number }>
    >`
      select
        (select count(*)::integer
           from public.task_completions
          where task_id = ${created.taskId}) as completions,
        (select coalesce(sum(ledger.points), 0)::integer
           from public.point_ledger as ledger
           join public.task_completions as receipt
             on receipt.id = ledger.completion_id
          where receipt.task_id = ${created.taskId}) as points
    `;
    expect(artifacts).toEqual({ completions: 1, points: 40 });

    const ownerEdit = await updateTask({
      actorId: taskOwnerId,
      taskId: created.taskId,
      title: "Complete a medium task",
      description: "Owner added a helpful summary",
      assigneeId: taskAssigneeId,
      effort: "medium",
      dueAt: null,
      status: "done",
      occurredAt,
    });
    expect(ownerEdit).toEqual({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "done",
      completion: null,
    });

    const adminEdit = await updateTask({
      actorId: taskAdminId,
      taskId: created.taskId,
      title: "Complete and share a medium task",
      description: "Owner added a helpful summary",
      assigneeId: taskAssigneeId,
      effort: "medium",
      dueAt: null,
      status: "done",
      occurredAt,
    });
    expect(adminEdit).toEqual({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "done",
      completion: null,
    });

    const replay = await updateTask({
      actorId: taskAssigneeId,
      taskId: created.taskId,
      title: "Complete and share a medium task",
      description: "Owner added a helpful summary",
      assigneeId: taskAssigneeId,
      effort: "medium",
      dueAt: null,
      status: "done",
      occurredAt,
    });
    expect(replay).toMatchObject({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      completion: {
        completionId: result.completion.completionId,
        wasNewCompletion: false,
        points: { finalPoints: 40 },
      },
    });

    const boardReplay = await moveTask({
      actorId: taskAssigneeId,
      taskId: created.taskId,
      status: "done",
      occurredAt,
    });
    expect(boardReplay).toMatchObject({
      taskId: created.taskId,
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      completion: {
        completionId: result.completion.completionId,
        wasNewCompletion: false,
        points: { finalPoints: 40 },
      },
    });

    const [persistedEdit] = await database()<
      Array<{
        completions: number;
        points: number;
        title: string;
        description: string | null;
      }>
    >`
      select
        (select count(*)::integer
           from public.task_completions
          where task_id = ${created.taskId}) as completions,
        (select coalesce(sum(ledger.points), 0)::integer
           from public.point_ledger as ledger
           join public.task_completions as receipt
             on receipt.id = ledger.completion_id
          where receipt.task_id = ${created.taskId}) as points,
        task.title,
        task.description
      from public.tasks as task
      where task.id = ${created.taskId}
    `;
    expect(persistedEdit).toEqual({
      completions: 1,
      points: 40,
      title: "Complete and share a medium task",
      description: "Owner added a helpful summary",
    });

    await expect(
      updateTask({
        actorId: taskAssigneeId,
        taskId: created.taskId,
        title: "Complete and share a medium task",
        description: "Owner added a helpful summary",
        assigneeId: taskReplacementId,
        effort: "medium",
        dueAt: null,
        status: "done",
        occurredAt,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Completed tasks cannot be reassigned.",
    });
  });

  it("delegates create-as-Done through the same completion engine", async () => {
    const result = await createTask({
      actorId: taskReplacementId,
      projectId: taskProjectId,
      title: "Capture the retrospective notes",
      description: null,
      assigneeId: taskReplacementId,
      effort: "medium",
      dueAt: null,
      status: "done",
      occurredAt,
    });

    expect(result).toMatchObject({
      workspaceId: taskWorkspaceId,
      projectId: taskProjectId,
      status: "done",
      completion: {
        wasNewCompletion: true,
        points: { finalPoints: 40 },
      },
    });
  });
});
