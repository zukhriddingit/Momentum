import "server-only";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import type { VerifiedGitHubIdentity } from "@/server/auth/github-identity";
import type { CohortClaimReceipt } from "@/server/cohort/types";
import { database } from "@/server/db/client";
import { AppError } from "@/server/errors";

const MAX_POSTGRES_BIGINT = BigInt("9223372036854775807");
const ZERO = BigInt(0);

interface SeatRow {
  id: string;
  workspace_id: string;
  user_id: string | null;
}

function validateInput(input: {
  identity: VerifiedGitHubIdentity;
  occurredAt: Date;
}): void {
  const normalizedHandle = normalizeGitHubHandle(input.identity.githubHandle);
  let githubUserId: bigint;

  try {
    githubUserId = BigInt(input.identity.githubUserId);
  } catch {
    throw new TypeError("A valid verified GitHub identity is required.");
  }

  if (
    normalizedHandle !== input.identity.githubHandle ||
    !/^\d+$/.test(input.identity.githubUserId) ||
    githubUserId <= ZERO ||
    githubUserId > MAX_POSTGRES_BIGINT ||
    input.identity.displayName.trim().length < 1 ||
    input.identity.displayName.trim().length > 80
  ) {
    throw new TypeError("A valid verified GitHub identity is required.");
  }

  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new TypeError("A valid cohort claim time is required.");
  }
}

export async function claimCohortSeats(input: {
  actorId: string;
  identity: VerifiedGitHubIdentity;
  occurredAt: Date;
}): Promise<CohortClaimReceipt> {
  validateInput(input);

  return database().begin(async (sql) => {
    await sql`
      insert into public.profiles (
        id,
        display_name,
        timezone,
        motivation_tone
      ) values (
        ${input.actorId},
        ${input.identity.displayName.trim()},
        'UTC',
        'friendly'
      )
      on conflict (id) do nothing
    `;
    await sql`
      insert into public.motivation_preferences (user_id)
      values (${input.actorId})
      on conflict (user_id) do nothing
    `;

    // Serialize claims for one stable provider identity, including the case
    // where no profile is linked yet and a row lock cannot protect the gap.
    await sql`
      select pg_catalog.pg_advisory_xact_lock(
        ${input.identity.githubUserId}::bigint
      )
    `;

    const [profile] = await sql<Array<{ github_user_id: string | null }>>`
      select github_user_id::text
      from public.profiles
      where id = ${input.actorId}
      for update
    `;
    if (
      !profile ||
      (profile.github_user_id !== null &&
        profile.github_user_id !== input.identity.githubUserId)
    ) {
      throw new AppError(
        "CONFLICT",
        "That Momentum profile is linked to a different GitHub identity.",
      );
    }

    const [conflictingProfile] = await sql<Array<{ id: string }>>`
      select id
      from public.profiles
      where github_user_id = ${input.identity.githubUserId}::bigint
        and id <> ${input.actorId}
      for update
    `;
    if (conflictingProfile) {
      throw new AppError(
        "CONFLICT",
        "That GitHub identity is already linked to another Momentum profile.",
      );
    }

    await sql`
      update public.profiles
      set
        github_user_id = ${input.identity.githubUserId}::bigint,
        github_handle = ${input.identity.githubHandle},
        updated_at = ${input.occurredAt}
      where id = ${input.actorId}
        and (
          github_user_id is distinct from ${input.identity.githubUserId}::bigint
          or github_handle is distinct from ${input.identity.githubHandle}
        )
    `;

    const seats = await sql<SeatRow[]>`
      select id, workspace_id, user_id
      from public.workspace_cohort_seats
      where github_user_id = ${input.identity.githubUserId}::bigint
      order by workspace_id, id
      for update
    `;
    if (
      seats.some(
        (seat) => seat.user_id !== null && seat.user_id !== input.actorId,
      )
    ) {
      throw new AppError(
        "CONFLICT",
        "That GitHub identity is already linked to another Momentum profile.",
      );
    }

    const pendingSeats = seats.filter((seat) => seat.user_id === null);
    if (pendingSeats.length === 0) {
      return {
        workspaceIds: [],
        claimedSeatCount: 0,
        activatedTaskCount: 0,
      };
    }

    const workspaceIds = [
      ...new Set(pendingSeats.map((seat) => seat.workspace_id)),
    ].sort();
    for (const workspaceId of workspaceIds) {
      await sql`
        insert into public.workspace_memberships (
          workspace_id,
          user_id,
          role,
          joined_at
        ) values (
          ${workspaceId},
          ${input.actorId},
          'member',
          ${input.occurredAt}
        )
        on conflict (workspace_id, user_id) do nothing
      `;
    }

    const activatedTasks = await sql<Array<{ id: string }>>`
      update public.tasks as task
      set
        assignee_id = ${input.actorId},
        cohort_seat_id = null,
        updated_at = ${input.occurredAt}
      from public.workspace_cohort_seats as seat
      where task.cohort_seat_id = seat.id
        and seat.github_user_id = ${input.identity.githubUserId}::bigint
        and seat.user_id is null
      returning task.id
    `;

    const claimedSeats = await sql<Array<{ id: string }>>`
      update public.workspace_cohort_seats
      set
        github_handle = ${input.identity.githubHandle},
        user_id = ${input.actorId},
        claimed_at = ${input.occurredAt}
      where github_user_id = ${input.identity.githubUserId}::bigint
        and user_id is null
      returning id
    `;

    return {
      workspaceIds,
      claimedSeatCount: claimedSeats.length,
      activatedTaskCount: activatedTasks.length,
    };
  });
}
