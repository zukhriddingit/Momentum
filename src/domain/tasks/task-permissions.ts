export type MembershipRole = "owner" | "admin" | "member";

export interface TaskPermissionInput {
  actorId: string;
  role: MembershipRole;
  createdBy: string;
  assigneeId: string | null;
  firstCompletedAt: Date | null;
}

export interface TaskPermissions {
  canEdit: boolean;
  canReassign: boolean;
  canMove: boolean;
  canComplete: boolean;
}

export function getTaskPermissions(
  input: TaskPermissionInput,
): TaskPermissions {
  const privileged = input.role === "owner" || input.role === "admin";
  const creator = input.createdBy === input.actorId;
  const active = input.assigneeId !== null;
  const assignee = input.assigneeId === input.actorId;
  const canEdit = privileged || creator;

  return {
    canEdit,
    canReassign: canEdit && input.firstCompletedAt === null,
    canMove: active && (canEdit || assignee),
    canComplete: active && assignee,
  };
}
