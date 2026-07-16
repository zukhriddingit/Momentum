import { afterAll, describe, expect, it } from "vitest";

import { closeDatabase, database } from "@/server/db/client";
import { getDashboard } from "@/server/dashboard/get-dashboard";
import { ensureProfile } from "@/server/profiles/ensure-profile";
import { createProject } from "@/server/projects/create-project";
import { createWorkspace } from "@/server/workspaces/create-workspace";
import { listWorkspaceNavigation } from "@/server/workspaces/list-workspace-navigation";
import { insertAuthUser, selfServiceUuid } from "../fixtures/self-service";

describe("profile recovery", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("returns the same profile without creating a duplicate", async () => {
    const userId = selfServiceUuid(1);

    await insertAuthUser({
      id: userId,
      email: "profile-recovery@momentum.local",
      displayName: "Self Service User",
      timezone: "America/New_York",
    });

    await database()`
      delete from public.profiles
      where id = ${userId}
    `;

    const first = await ensureProfile({
      actorId: userId,
      displayName: "Self Service User",
      timezone: "america/new_york",
    });
    const second = await ensureProfile({
      actorId: userId,
      displayName: "Self Service User",
      timezone: "America/New_York",
    });

    expect(second).toEqual(first);
    expect(first).toEqual({
      id: userId,
      displayName: "Self Service User",
      timezone: "America/New_York",
      motivationTone: "friendly",
    });

    const [profileCount] = await database()<Array<{ count: number }>>`
      select count(*)::integer as count
      from public.profiles
      where id = ${userId}
    `;
    if (!profileCount) {
      throw new Error("Expected a profile count row.");
    }
    expect(profileCount.count).toBe(1);
  });

  it("initializes default motivation preferences for a fresh auth user", async () => {
    const userId = selfServiceUuid(3);

    await insertAuthUser({
      id: userId,
      email: "preference-defaults@momentum.local",
      displayName: "Preference Defaults",
      timezone: "America/New_York",
    });

    const preferenceRows = await database()<
      Array<{
        deadline_nudges_enabled: boolean;
        celebration_animation_enabled: boolean;
        achievement_visibility_enabled: boolean;
      }>
    >`
      select deadline_nudges_enabled,
             celebration_animation_enabled,
             achievement_visibility_enabled
      from public.motivation_preferences
      where user_id = ${userId}
    `;

    expect(preferenceRows[0]).toEqual({
      deadline_nudges_enabled: true,
      celebration_animation_enabled: true,
      achievement_visibility_enabled: true,
    });
  });

  it("does not overwrite an existing profile with conflicting details", async () => {
    const userId = selfServiceUuid(2);

    await insertAuthUser({
      id: userId,
      email: "profile-conflict@momentum.local",
      displayName: "Original Name",
      timezone: "America/New_York",
    });

    await expect(
      ensureProfile({
        actorId: userId,
        displayName: "Different Name",
        timezone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That profile already exists with different details.",
    });
  });
});

describe("workspace onboarding", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("recovers onboarding from no workspace through the first project", async () => {
    const userId = selfServiceUuid(10);

    await insertAuthUser({
      id: userId,
      email: "workspace-owner@momentum.local",
      displayName: "Workspace Owner",
      timezone: "America/New_York",
    });

    await expect(listWorkspaceNavigation({ actorId: userId })).resolves.toEqual(
      { workspaces: [] },
    );

    const workspace = await createWorkspace({
      actorId: userId,
      name: "My Workspace",
    });

    expect(workspace).toMatchObject({
      name: "My Workspace",
      role: "owner",
    });

    await expect(listWorkspaceNavigation({ actorId: userId })).resolves.toEqual(
      {
        workspaces: [
          {
            id: workspace.id,
            name: "My Workspace",
            role: "owner",
            projects: [],
          },
        ],
      },
    );

    const [membership] = await database()<Array<{ role: string }>>`
      select role::text
      from public.workspace_memberships
      where workspace_id = ${workspace.id}
        and user_id = ${userId}
    `;
    expect(membership?.role).toBe("owner");

    const dashboard = await getDashboard({
      actorId: userId,
      occurredAt: new Date("2026-07-15T16:00:00.000Z"),
    });
    expect(dashboard.hasWorkspace).toBe(true);
    expect(dashboard.projects).toEqual([]);

    const project = await createProject({
      actorId: userId,
      workspaceId: workspace.id,
      name: "My First Project",
      description: "The first clear outcome",
    });

    await expect(listWorkspaceNavigation({ actorId: userId })).resolves.toEqual(
      {
        workspaces: [
          {
            id: workspace.id,
            name: "My Workspace",
            role: "owner",
            projects: [{ id: project.id, name: "My First Project" }],
          },
        ],
      },
    );
  });

  it("rejects a missing profile without leaving workspace rows", async () => {
    const missingUserId = selfServiceUuid(11);
    const workspaceName = "Must Roll Back";

    await insertAuthUser({
      id: missingUserId,
      email: "missing-profile@momentum.local",
      displayName: "Missing Profile",
      timezone: "America/New_York",
    });
    await database()`
      delete from public.profiles
      where id = ${missingUserId}
    `;

    await expect(
      createWorkspace({
        actorId: missingUserId,
        name: workspaceName,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Profile not found.",
    });

    const [counts] = await database()<
      Array<{ workspace_count: number; membership_count: number }>
    >`
      select
        (
          select count(*)::integer
          from public.workspaces
          where name = ${workspaceName}
        ) as workspace_count,
        (
          select count(*)::integer
          from public.workspace_memberships
          where user_id = ${missingUserId}
        ) as membership_count
    `;

    expect(counts).toEqual({ workspace_count: 0, membership_count: 0 });
  });

  it("returns only the actor's workspaces and projects in stable order", async () => {
    const actorId = selfServiceUuid(12);
    const otherUserId = selfServiceUuid(13);

    await insertAuthUser({
      id: actorId,
      email: "navigation-actor@momentum.local",
      displayName: "Navigation Actor",
      timezone: "America/New_York",
    });
    await insertAuthUser({
      id: otherUserId,
      email: "navigation-other@momentum.local",
      displayName: "Navigation Other",
      timezone: "America/New_York",
    });

    const firstWorkspace = await createWorkspace({
      actorId,
      name: "Alpha Workspace",
    });
    const secondWorkspace = await createWorkspace({
      actorId,
      name: "Beta Workspace",
    });
    const hiddenWorkspace = await createWorkspace({
      actorId: otherUserId,
      name: "Hidden Workspace",
    });

    const firstProjectId = selfServiceUuid(14);
    const secondProjectId = selfServiceUuid(15);
    const hiddenProjectId = selfServiceUuid(16);
    await database()`
      insert into public.projects (
        id,
        workspace_id,
        name,
        description,
        created_by,
        created_at
      )
      values
        (
          ${secondProjectId},
          ${secondWorkspace.id},
          'Later Project',
          null,
          ${actorId},
          '2026-07-15T14:00:00.000Z'
        ),
        (
          ${firstProjectId},
          ${secondWorkspace.id},
          'Earlier Project',
          null,
          ${actorId},
          '2026-07-15T13:00:00.000Z'
        ),
        (
          ${hiddenProjectId},
          ${hiddenWorkspace.id},
          'Hidden Project',
          null,
          ${otherUserId},
          '2026-07-15T12:00:00.000Z'
        )
    `;
    await database()`
      update public.workspaces
      set created_at = case id
        when ${firstWorkspace.id} then '2026-07-15T10:00:00.000Z'::timestamptz
        when ${secondWorkspace.id} then '2026-07-15T11:00:00.000Z'::timestamptz
        else created_at
      end
      where id in (${firstWorkspace.id}, ${secondWorkspace.id})
    `;

    const navigation = await listWorkspaceNavigation({ actorId });

    expect(navigation).toEqual({
      workspaces: [
        {
          id: firstWorkspace.id,
          name: "Alpha Workspace",
          role: "owner",
          projects: [],
        },
        {
          id: secondWorkspace.id,
          name: "Beta Workspace",
          role: "owner",
          projects: [
            { id: firstProjectId, name: "Earlier Project" },
            { id: secondProjectId, name: "Later Project" },
          ],
        },
      ],
    });
  });
});
