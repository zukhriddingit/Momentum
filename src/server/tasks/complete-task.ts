import "server-only";

import { database } from "@/server/db/client";
import { completeTaskInTransaction } from "@/server/tasks/complete-task-transaction";
import type { CompletionReceipt } from "@/server/types";

export interface CompletionInput {
  actorId: string;
  taskId: string;
  occurredAt: Date;
}

export async function completeTask(
  input: CompletionInput,
): Promise<CompletionReceipt> {
  return database().begin((sql) => completeTaskInTransaction(sql, input));
}
