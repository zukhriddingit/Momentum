import "server-only";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import type {
  CohortDirectoryEntry,
  CohortSeatView,
} from "@/server/cohort/types";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";

interface CohortSeatRow {
  id: string;
  workspace_id: string;
  github_user_id: string;
  github_handle: string;
  user_id: string | null;
  claimed_at: Date | null;
}

const MAX_POSTGRES_BIGINT = BigInt("9223372036854775807");
const ZERO = BigInt(0);

function validateInput(input: {
  participant: CohortDirectoryEntry;
  occurredAt: Date;
}): void {
  const normalizedHandle = normalizeGitHubHandle(
    input.participant.githubHandle,
  );
  let githubUserId: bigint;

  try {
    githubUserId = BigInt(input.participant.githubUserId);
  } catch {
    throw new TypeError("A valid cohort participant is required.");
  }

  if (
    normalizedHandle !== input.participant.githubHandle ||
    !/^\d+$/.test(input.participant.githubUserId) ||
    githubUserId <= ZERO ||
    githubUserId > MAX_POSTGRES_BIGINT
  ) {
    throw new TypeError("A valid cohort participant is required.");
  }

  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new TypeError("A valid cohort seat time is required.");
  }
}

function toView(seat: CohortSeatRow): CohortSeatView {
  return {
    id: seat.id,
    workspaceId: seat.workspace_id,
    githubUserId: seat.github_user_id,
    githubHandle: seat.github_handle,
    profileUrl: `https://github.com/${seat.github_handle}`,
    userId: seat.user_id,
    claimedAt: seat.claimed_at?.toISOString() ?? null,
  };
}

export async function addCohortSeat(input: {
  actorId: string;
  workspaceId: string;
  participant: CohortDirectoryEntry;
  occurredAt: Date;
}): Promise<CohortSeatView> {
  validateInput(input);

  return database().begin(async (sql) => {
    const [authorizedWorkspace] = await sql<Array<{ id: string }>>`
      select workspace.id
      from public.workspaces as workspace
      join public.workspace_memberships as membership
        on membership.workspace_id = workspace.id
       and membership.user_id = ${input.actorId}
       and membership.role in ('owner', 'admin')
      where workspace.id = ${input.workspaceId}
      for update of workspace, membership
    `;

    if (!authorizedWorkspace) {
      throw new AppError("NOT_FOUND", "Workspace not found.");
    }

    let [seat] = await sql<CohortSeatRow[]>`
      select
        id,
        workspace_id,
        github_user_id::text,
        github_handle,
        user_id,
        claimed_at
      from public.workspace_cohort_seats
      where workspace_id = ${authorizedWorkspace.id}
        and github_user_id = ${input.participant.githubUserId}::bigint
      for update
    `;

    if (seat?.user_id) {
      return toView(seat);
    }

    const [linkedProfile] = await sql<Array<{ id: string }>>`
      select id
      from public.profiles
      where github_user_id = ${input.participant.githubUserId}::bigint
      for update
    `;

    if (!seat) {
      const [insertedSeat] = await sql<CohortSeatRow[]>`
        insert into public.workspace_cohort_seats (
          id,
          workspace_id,
          github_user_id,
          github_handle,
          user_id,
          created_by,
          created_at,
          claimed_at
        ) values (
          ${crypto.randomUUID()},
          ${authorizedWorkspace.id},
          ${input.participant.githubUserId}::bigint,
          ${input.participant.githubHandle},
          ${linkedProfile?.id ?? null},
          ${input.actorId},
          ${input.occurredAt},
          ${linkedProfile ? input.occurredAt : null}
        )
        returning
          id,
          workspace_id,
          github_user_id::text,
          github_handle,
          user_id,
          claimed_at
      `;

      if (!insertedSeat) {
        throw new Error("Cohort seat creation did not return the seat.");
      }
      seat = insertedSeat;
    } else if (seat.github_handle !== input.participant.githubHandle) {
      const [renamedSeat] = await sql<CohortSeatRow[]>`
        update public.workspace_cohort_seats
        set github_handle = ${input.participant.githubHandle}
        where id = ${seat.id}
        returning
          id,
          workspace_id,
          github_user_id::text,
          github_handle,
          user_id,
          claimed_at
      `;
      if (!renamedSeat) {
        throw new Error("Cohort seat update did not return the seat.");
      }
      seat = renamedSeat;
    }

    if (!linkedProfile) {
      return toView(seat);
    }

    await sql`
      insert into public.workspace_memberships (
        workspace_id,
        user_id,
        role,
        joined_at
      ) values (
        ${authorizedWorkspace.id},
        ${linkedProfile.id},
        'member',
        ${input.occurredAt}
      )
      on conflict (workspace_id, user_id) do nothing
    `;

    if (seat.user_id === null) {
      await sql`
        update public.tasks
        set
          assignee_id = ${linkedProfile.id},
          cohort_seat_id = null,
          updated_at = ${input.occurredAt}
        where cohort_seat_id = ${seat.id}
      `;

      const [claimedSeat] = await sql<CohortSeatRow[]>`
        update public.workspace_cohort_seats
        set
          user_id = ${linkedProfile.id},
          claimed_at = ${input.occurredAt}
        where id = ${seat.id}
        returning
          id,
          workspace_id,
          github_user_id::text,
          github_handle,
          user_id,
          claimed_at
      `;
      if (!claimedSeat) {
        throw new Error("Cohort seat claim did not return the seat.");
      }
      seat = claimedSeat;
    }

    return toView(seat);
  });
}
