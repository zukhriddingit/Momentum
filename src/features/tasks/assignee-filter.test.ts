import { describe, expect, it } from "vitest";

import type { TaskPermissions } from "@/domain/tasks/task-permissions";
import type { TaskAssigneeView, TaskView } from "@/server/types";

import { filterTasksByAssignee } from "./assignee-filter";

const permissions: TaskPermissions = {
  canEdit: true,
  canReassign: true,
  canMove: true,
  canComplete: true,
};

function task(id: string, assignee: TaskAssigneeView): TaskView {
  return {
    id,
    createdBy: "creator-id",
    title: `Task ${id}`,
    description: null,
    assignee,
    status: "todo",
    effort: "small",
    dueAt: null,
    estimatedBasePoints: 20,
    permissions,
    isCurrentUsersTask: assignee.kind === "member" && assignee.userId === "me",
    isFocusTask: false,
  };
}

const tasks: TaskView[] = [
  task("self-task", {
    kind: "member",
    userId: "me",
    displayName: "Me",
  }),
  task("teammate-task", {
    kind: "member",
    userId: "teammate",
    displayName: "Teammate",
  }),
  task("cohort-task", {
    kind: "cohort",
    seatId: "pending-seat",
    githubHandle: "future-teammate",
    profileUrl: "https://github.com/future-teammate",
  }),
];

describe("filterTasksByAssignee", () => {
  it("returns all tasks for the all filter", () => {
    expect(filterTasksByAssignee(tasks, "all", "me")).toEqual(tasks);
  });

  it("returns the current user's active tasks for the me filter", () => {
    expect(
      filterTasksByAssignee(tasks, "me", "me").map(({ id }) => id),
    ).toEqual(["self-task"]);
  });

  it("filters active members by their encoded browser key", () => {
    expect(
      filterTasksByAssignee(tasks, "member:teammate", "me").map(({ id }) => id),
    ).toEqual(["teammate-task"]);
  });

  it("filters pending cohort seats by their encoded browser key", () => {
    expect(
      filterTasksByAssignee(tasks, "cohort:pending-seat", "me").map(
        ({ id }) => id,
      ),
    ).toEqual(["cohort-task"]);
  });

  it("falls back to all tasks for an invalid filter", () => {
    expect(
      filterTasksByAssignee(tasks, "unexpected:teammate" as never, "me"),
    ).toEqual(tasks);
  });
});
