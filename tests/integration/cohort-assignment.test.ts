import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { addCohortSeat } from "@/server/cohort/add-cohort-seat";
import { claimCohortSeats } from "@/server/cohort/claim-cohort-seats";
import type { CohortDirectoryEntry } from "@/server/cohort/types";
import { closeDatabase, database } from "@/server/db/client";
import { selectFocusTask } from "@/server/focus/select-focus-task";
import { createProject } from "@/server/projects/create-project";
import { completeTask } from "@/server/tasks/complete-task";
import { createTask } from "@/server/tasks/create-task";
import { moveTask } from "@/server/tasks/move-task";
import { updateTask } from "@/server/tasks/update-task";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { requireWorkspaceManager } from "@/server/workspaces/require-workspace-manager";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

const occurredAt = new Date("2026-07-18T15:00:00.000Z");
const ownerId = selfServiceUuid(800);
const adminId = selfServiceUuid(801);
const memberId = selfServiceUuid(802);
const outsiderId = selfServiceUuid(803);
const claimantId = selfServiceUuid(804);
const linkedProfileId = selfServiceUuid(805);
const conflictingProfileId = selfServiceUuid(806);
const lateLinkedProfileId = selfServiceUuid(810);

const participant = {
  githubUserId: "227412781",
  githubHandle: "kperpignant",
  profileUrl: "https://github.com/kperpignant",
  sourcePullRequestUrl:
    "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
  displayName: null,
} satisfies CohortDirectoryEntry;

const linkedParticipant = {
  ...participant,
  githubUserId: "227412782",
  githubHandle: "linked-builder",
  profileUrl: "https://github.com/linked-builder",
  sourcePullRequestUrl: null,
} satisfies CohortDirectoryEntry;

const conflictingParticipant = {
  ...participant,
  githubUserId: "227412783",
  githubHandle: "conflicting-builder",
  profileUrl: "https://github.com/conflicting-builder",
  sourcePullRequestUrl: null,
} satisfies CohortDirectoryEntry;

const lateLinkedParticipant = {
  ...participant,
  githubUserId: "227412784",
  githubHandle: "late-linked-builder",
  profileUrl: "https://github.com/late-linked-builder",
  sourcePullRequestUrl: null,
} satisfies CohortDirectoryEntry;

const pendingParticipant = {
  ...participant,
  githubUserId: "227412785",
  githubHandle: "pending-builder",
  profileUrl: "https://github.com/pending-builder",
  sourcePullRequestUrl: null,
} satisfies CohortDirectoryEntry;

let workspaceId: string;
let projectId: string;

function seatInput(
  actorId: string,
  targetParticipant: CohortDirectoryEntry = participant,
) {
  return {
    actorId,
    workspaceId,
    participant: targetParticipant,
    occurredAt,
  };
}

describe("cohort seat authorization and verified identity claims", () => {
  beforeAll(async () => {
    await Promise.all([
      insertAuthUser({
        id: ownerId,
        email: "cohort-owner@momentum.local",
        displayName: "Cohort Owner",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: adminId,
        email: "cohort-admin@momentum.local",
        displayName: "Cohort Admin",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: memberId,
        email: "cohort-member@momentum.local",
        displayName: "Cohort Member",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: outsiderId,
        email: "cohort-outsider@momentum.local",
        displayName: "Cohort Outsider",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: claimantId,
        email: "cohort-claimant@momentum.local",
        displayName: "Claimant",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: linkedProfileId,
        email: "cohort-linked@momentum.local",
        displayName: "Linked Participant",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: conflictingProfileId,
        email: "cohort-conflict@momentum.local",
        displayName: "Conflicting Participant",
        timezone: "UTC",
      }),
      insertAuthUser({
        id: lateLinkedProfileId,
        email: "cohort-late-linked@momentum.local",
        displayName: "Late Linked Participant",
        timezone: "UTC",
      }),
    ]);

    const workspace = await createWorkspace({
      actorId: ownerId,
      name: "Cohort Integration Workspace",
    });
    const project = await createProject({
      actorId: ownerId,
      workspaceId: workspace.id,
      name: "Cohort Integration Project",
      description: null,
    });
    workspaceId = workspace.id;
    projectId = project.id;

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

  it("prechecks owner and admin access while hiding workspaces from everyone else", async () => {
    await expect(
      requireWorkspaceManager({ actorId: ownerId, workspaceId }),
    ).resolves.toBeUndefined();
    await expect(
      requireWorkspaceManager({ actorId: adminId, workspaceId }),
    ).resolves.toBeUndefined();

    for (const deniedWorkspace of [workspaceId, selfServiceUuid(899)]) {
      await expect(
        requireWorkspaceManager({
          actorId: memberId,
          workspaceId: deniedWorkspace,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }

    await expect(
      requireWorkspaceManager({ actorId: outsiderId, workspaceId }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Workspace not found.",
    });
  });

  it("allows owners and admins to add once while hiding the workspace from members and outsiders", async () => {
    const ownerSeat = await addCohortSeat(seatInput(ownerId));
    const adminSeat = await addCohortSeat(seatInput(adminId));

    expect(ownerSeat).toMatchObject({
      workspaceId,
      githubUserId: participant.githubUserId,
      githubHandle: participant.githubHandle,
      profileUrl: participant.profileUrl,
      userId: null,
      claimedAt: null,
    });
    expect(adminSeat).toEqual(ownerSeat);

    for (const actorId of [memberId, outsiderId]) {
      await expect(addCohortSeat(seatInput(actorId))).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }

    const seatCount = await database()<Array<{ count: number }>>`
      select count(*)::integer as count
      from public.workspace_cohort_seats
      where workspace_id = ${workspaceId}
        and github_user_id = ${participant.githubUserId}::bigint
    `;
    expect(seatCount).toEqual([{ count: 1 }]);
  });

  it("immediately activates an already-linked participant without changing an existing role", async () => {
    const sql = database();
    await sql`
      update public.profiles
      set github_user_id = ${linkedParticipant.githubUserId}::bigint,
          github_handle = ${linkedParticipant.githubHandle}
      where id = ${linkedProfileId}
    `;
    await sql`
      insert into public.workspace_memberships (workspace_id, user_id, role)
      values (${workspaceId}, ${linkedProfileId}, 'admin')
    `;

    const seat = await addCohortSeat(seatInput(ownerId, linkedParticipant));

    expect(seat).toMatchObject({
      userId: linkedProfileId,
      claimedAt: occurredAt.toISOString(),
    });
    expect(
      await sql`
        select role::text
        from public.workspace_memberships
        where workspace_id = ${workspaceId} and user_id = ${linkedProfileId}
      `,
    ).toEqual([{ role: "admin" }]);
  });

  it("converts pending tasks before activating a seat that has since become linked", async () => {
    const sql = database();
    const pendingSeat = await addCohortSeat(
      seatInput(ownerId, lateLinkedParticipant),
    );
    const taskId = selfServiceUuid(811);
    await sql`
      insert into public.tasks (
        id, project_id, title, cohort_seat_id, status, effort, created_by
      ) values (
        ${taskId}, ${projectId}, 'Late-linked participant task',
        ${pendingSeat.id}, 'todo', 'small', ${ownerId}
      )
    `;
    await sql`
      update public.profiles
      set github_user_id = ${lateLinkedParticipant.githubUserId}::bigint,
          github_handle = ${lateLinkedParticipant.githubHandle}
      where id = ${lateLinkedProfileId}
    `;

    const activatedSeat = await addCohortSeat(
      seatInput(adminId, lateLinkedParticipant),
    );

    expect(activatedSeat).toMatchObject({
      id: pendingSeat.id,
      userId: lateLinkedProfileId,
      claimedAt: occurredAt.toISOString(),
    });
    expect(
      await sql`
        select assignee_id, cohort_seat_id
        from public.tasks
        where id = ${taskId}
      `,
    ).toEqual([{ assignee_id: lateLinkedProfileId, cohort_seat_id: null }]);
    expect(
      await sql`
        select role::text
        from public.workspace_memberships
        where workspace_id = ${workspaceId}
          and user_id = ${lateLinkedProfileId}
      `,
    ).toEqual([{ role: "member" }]);
  });

  it("rolls back every claim mutation when the verified identity belongs to another profile", async () => {
    const sql = database();
    const seat = await addCohortSeat(
      seatInput(ownerId, conflictingParticipant),
    );
    const taskId = selfServiceUuid(807);
    await sql`
      insert into public.tasks (
        id, project_id, title, cohort_seat_id, status, effort, created_by
      ) values (
        ${taskId}, ${projectId}, 'Conflicting identity task', ${seat.id},
        'todo', 'small', ${ownerId}
      )
    `;
    await sql`
      update public.profiles
      set github_user_id = ${conflictingParticipant.githubUserId}::bigint,
          github_handle = ${conflictingParticipant.githubHandle}
      where id = ${conflictingProfileId}
    `;

    await expect(
      claimCohortSeats({
        actorId: claimantId,
        identity: {
          githubUserId: conflictingParticipant.githubUserId,
          githubHandle: conflictingParticipant.githubHandle,
          displayName: "Conflicting Builder",
        },
        occurredAt,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "That GitHub identity is already linked to another Momentum profile.",
    });

    expect(
      await sql`
        select github_user_id::text, github_handle
        from public.profiles
        where id = ${claimantId}
      `,
    ).toEqual([{ github_user_id: null, github_handle: null }]);
    expect(
      await sql`
        select user_id, claimed_at
        from public.workspace_cohort_seats
        where id = ${seat.id}
      `,
    ).toEqual([{ user_id: null, claimed_at: null }]);
    expect(
      await sql`
        select assignee_id, cohort_seat_id
        from public.tasks
        where id = ${taskId}
      `,
    ).toEqual([{ assignee_id: null, cohort_seat_id: seat.id }]);
  });

  it("keeps pending assignments in To Do and outside every trusted progress workflow", async () => {
    const sql = database();
    const seat = await addCohortSeat(seatInput(ownerId, pendingParticipant));
    const foreignWorkspace = await createWorkspace({
      actorId: ownerId,
      name: "Foreign Pending Seat Workspace",
    });
    const foreignSeat = await addCohortSeat({
      actorId: ownerId,
      workspaceId: foreignWorkspace.id,
      participant: pendingParticipant,
      occurredAt,
    });

    await expect(
      createTask({
        actorId: ownerId,
        projectId,
        title: "Cross-workspace pending assignment",
        description: null,
        assignee: { kind: "cohort", seatId: foreignSeat.id },
        effort: "small",
        dueAt: null,
        status: "todo",
        occurredAt,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Task not found.",
    });

    const task = await createTask({
      actorId: ownerId,
      projectId,
      title: "Pending participant task",
      description: null,
      assignee: { kind: "cohort", seatId: seat.id },
      effort: "medium",
      dueAt: null,
      status: "in_progress",
      occurredAt,
    });
    expect(task).toEqual({
      taskId: expect.any(String),
      workspaceId,
      projectId,
      status: "todo",
      completion: null,
    });

    await expect(
      updateTask({
        actorId: ownerId,
        taskId: task.taskId,
        title: "Pending participant task, clarified",
        description: "Ready whenever you join.",
        assignee: { kind: "cohort", seatId: seat.id },
        effort: "medium",
        dueAt: null,
        status: "done",
        occurredAt,
      }),
    ).resolves.toEqual({
      taskId: task.taskId,
      workspaceId,
      projectId,
      status: "todo",
      completion: null,
    });

    const loadArtifacts = async () => {
      const [artifacts] = await sql<
        Array<{
          focus_count: number;
          completion_count: number;
          ledger_count: number;
          streak_count: number;
          achievement_count: number;
          notification_count: number;
        }>
      >`
        select
          (select count(*)::integer from public.focus_selections where task_id = ${task.taskId}) as focus_count,
          (select count(*)::integer from public.task_completions where task_id = ${task.taskId}) as completion_count,
          (select count(*)::integer
             from public.point_ledger as ledger
             join public.task_completions as completion on completion.id = ledger.completion_id
            where completion.task_id = ${task.taskId}) as ledger_count,
          (select count(*)::integer from public.focus_streaks where user_id = ${ownerId}) as streak_count,
          (select count(*)::integer
             from public.achievement_grants as grant_row
             join public.task_completions as completion on completion.id = grant_row.completion_id
            where completion.task_id = ${task.taskId}) as achievement_count,
          (select count(*)::integer from public.notifications where task_id = ${task.taskId}) as notification_count
      `;
      return artifacts;
    };
    const artifactsBefore = await loadArtifacts();
    expect(artifactsBefore).toEqual({
      focus_count: 0,
      completion_count: 0,
      ledger_count: 0,
      streak_count: 0,
      achievement_count: 0,
      notification_count: 0,
    });

    await expect(
      selectFocusTask({
        actorId: ownerId,
        taskId: task.taskId,
        occurredAt,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      moveTask({
        actorId: ownerId,
        taskId: task.taskId,
        status: "in_progress",
        occurredAt,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      completeTask({
        actorId: ownerId,
        taskId: task.taskId,
        occurredAt,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(loadArtifacts()).resolves.toEqual(artifactsBefore);
    await expect(
      sql`
        select assignee_id, cohort_seat_id, status::text, title, description
        from public.tasks
        where id = ${task.taskId}
      `,
    ).resolves.toEqual([
      {
        assignee_id: null,
        cohort_seat_id: seat.id,
        status: "todo",
        title: "Pending participant task, clarified",
        description: "Ready whenever you join.",
      },
    ]);
  });

  it("claims seats across workspaces, converts tasks, preserves roles, and is idempotent", async () => {
    const sql = database();
    const currentVerifiedHandle = "kim-renamed";
    const firstSeat = await addCohortSeat(seatInput(ownerId));
    const secondWorkspace = await createWorkspace({
      actorId: ownerId,
      name: "Second Cohort Integration Workspace",
    });
    const secondProject = await createProject({
      actorId: ownerId,
      workspaceId: secondWorkspace.id,
      name: "Second Cohort Integration Project",
      description: null,
    });
    const secondSeat = await addCohortSeat({
      actorId: ownerId,
      workspaceId: secondWorkspace.id,
      participant,
      occurredAt,
    });
    await sql`
      delete from public.motivation_preferences
      where user_id = ${claimantId}
    `;
    await sql`
      insert into public.workspace_memberships (workspace_id, user_id, role)
      values (${workspaceId}, ${claimantId}, 'admin')
    `;
    const firstTaskId = selfServiceUuid(808);
    const secondTaskId = selfServiceUuid(809);
    await sql`
      insert into public.tasks (
        id, project_id, title, cohort_seat_id, status, effort, created_by
      ) values
        (${firstTaskId}, ${projectId}, 'Claim first workspace task', ${firstSeat.id}, 'todo', 'medium', ${ownerId}),
        (${secondTaskId}, ${secondProject.id}, 'Claim second workspace task', ${secondSeat.id}, 'todo', 'medium', ${ownerId})
    `;

    const first = await claimCohortSeats({
      actorId: claimantId,
      identity: {
        githubUserId: participant.githubUserId,
        githubHandle: currentVerifiedHandle,
        displayName: "Kim Perpignant",
      },
      occurredAt,
    });

    expect(first).toEqual({
      workspaceIds: [workspaceId, secondWorkspace.id].sort(),
      claimedSeatCount: 2,
      activatedTaskCount: 2,
    });
    expect(
      await sql`
        select user_id
        from public.motivation_preferences
        where user_id = ${claimantId}
      `,
    ).toEqual([{ user_id: claimantId }]);
    expect(
      await sql`
        select workspace_id, role::text
        from public.workspace_memberships
        where user_id = ${claimantId}
        order by workspace_id
      `,
    ).toEqual(
      [
        { workspace_id: workspaceId, role: "admin" },
        { workspace_id: secondWorkspace.id, role: "member" },
      ].sort((left, right) =>
        left.workspace_id.localeCompare(right.workspace_id),
      ),
    );
    expect(
      await sql`
        select id, assignee_id, cohort_seat_id
        from public.tasks
        where id in (${firstTaskId}, ${secondTaskId})
        order by id
      `,
    ).toEqual(
      [firstTaskId, secondTaskId].sort().map((id) => ({
        id,
        assignee_id: claimantId,
        cohort_seat_id: null,
      })),
    );
    expect(
      await sql`
        select id, github_handle, user_id, claimed_at
        from public.workspace_cohort_seats
        where id in (${firstSeat.id}, ${secondSeat.id})
        order by id
      `,
    ).toEqual(
      [firstSeat.id, secondSeat.id].sort().map((id) => ({
        id,
        github_handle: participant.githubHandle,
        user_id: claimantId,
        claimed_at: occurredAt,
      })),
    );
    expect(
      await sql`
        select github_user_id::text, github_handle
        from public.profiles
        where id = ${claimantId}
      `,
    ).toEqual([
      {
        github_user_id: participant.githubUserId,
        github_handle: currentVerifiedHandle,
      },
    ]);

    const second = await claimCohortSeats({
      actorId: claimantId,
      identity: {
        githubUserId: participant.githubUserId,
        githubHandle: currentVerifiedHandle,
        displayName: "Kim Perpignant",
      },
      occurredAt: new Date("2026-07-18T15:05:00.000Z"),
    });
    expect(second).toEqual({
      workspaceIds: [],
      claimedSeatCount: 0,
      activatedTaskCount: 0,
    });
    expect(
      await sql`
        select role::text, count(*)::integer as count
        from public.workspace_memberships
        where user_id = ${claimantId}
        group by role
        order by role
      `,
    ).toEqual([
      { role: "admin", count: 1 },
      { role: "member", count: 1 },
    ]);
  });
});
