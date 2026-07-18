import { describe, expect, it } from "vitest";

import { getTaskPermissions } from "@/domain/tasks/task-permissions";

describe("getTaskPermissions", () => {
  it.each(["owner", "admin"] as const)(
    "lets a workspace %s manage an incomplete task without completing another person's work",
    (role) => {
      expect(
        getTaskPermissions({
          actorId: role,
          role,
          createdBy: "creator",
          assigneeId: "assignee",
          firstCompletedAt: null,
        }),
      ).toEqual({
        canEdit: true,
        canReassign: true,
        canMove: true,
        canComplete: false,
      });
    },
  );

  it("lets a member manage a task they created", () => {
    expect(
      getTaskPermissions({
        actorId: "creator",
        role: "member",
        createdBy: "creator",
        assigneeId: "assignee",
        firstCompletedAt: null,
      }),
    ).toEqual({
      canEdit: true,
      canReassign: true,
      canMove: true,
      canComplete: false,
    });
  });

  it("lets an assigned member move and complete without editing task fields", () => {
    expect(
      getTaskPermissions({
        actorId: "assignee",
        role: "member",
        createdBy: "creator",
        assigneeId: "assignee",
        firstCompletedAt: null,
      }),
    ).toEqual({
      canEdit: false,
      canReassign: false,
      canMove: true,
      canComplete: true,
    });
  });

  it("does not grant task controls to an unrelated member", () => {
    expect(
      getTaskPermissions({
        actorId: "other-member",
        role: "member",
        createdBy: "creator",
        assigneeId: "assignee",
        firstCompletedAt: null,
      }),
    ).toEqual({
      canEdit: false,
      canReassign: false,
      canMove: false,
      canComplete: false,
    });
  });

  it("lets a creator edit but not move or complete a pending cohort task", () => {
    expect(
      getTaskPermissions({
        actorId: "creator",
        role: "member",
        createdBy: "creator",
        assigneeId: null,
        firstCompletedAt: null,
      }),
    ).toEqual({
      canEdit: true,
      canReassign: true,
      canMove: false,
      canComplete: false,
    });
  });

  it("freezes reassignment after first completion while preserving other privileges", () => {
    expect(
      getTaskPermissions({
        actorId: "owner",
        role: "owner",
        createdBy: "creator",
        assigneeId: "assignee",
        firstCompletedAt: new Date("2026-07-15T16:00:00.000Z"),
      }),
    ).toEqual({
      canEdit: true,
      canReassign: false,
      canMove: true,
      canComplete: false,
    });
  });
});
