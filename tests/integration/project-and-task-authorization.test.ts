import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { createProject } from "@/server/projects/create-project";
import { updateProject } from "@/server/projects/update-project";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { getWorkspaceOverview } from "@/server/workspaces/get-workspace-overview";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

const ownerId = selfServiceUuid(100);
const adminId = selfServiceUuid(101);
const memberId = selfServiceUuid(102);
const outsiderId = selfServiceUuid(103);

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
