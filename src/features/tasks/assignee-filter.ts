import type { TaskView } from "@/server/types";

export type AssigneeFilter =
  "all" | "me" | `member:${string}` | `cohort:${string}`;

export function filterTasksByAssignee(
  tasks: readonly TaskView[],
  filter: AssigneeFilter,
  actorId: string,
): TaskView[] {
  if (filter === "all") {
    return [...tasks];
  }

  if (filter === "me") {
    return tasks.filter(
      (task) =>
        task.assignee.kind === "member" && task.assignee.userId === actorId,
    );
  }

  const separator = filter.indexOf(":");
  const kind = filter.slice(0, separator);
  const id = filter.slice(separator + 1);
  if (!id || (kind !== "member" && kind !== "cohort")) {
    return [...tasks];
  }

  return tasks.filter((task) =>
    kind === "member"
      ? task.assignee.kind === "member" && task.assignee.userId === id
      : task.assignee.kind === "cohort" && task.assignee.seatId === id,
  );
}
