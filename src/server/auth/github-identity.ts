import "server-only";

import type { UserIdentity } from "@supabase/supabase-js";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import { AppError } from "@/server/errors";

const MAX_POSTGRES_BIGINT = BigInt("9223372036854775807");
const ZERO = BigInt(0);

export interface VerifiedGitHubIdentity {
  githubUserId: string;
  githubHandle: string;
  displayName: string;
}

function isPositivePostgresBigint(value: string): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  try {
    const numericValue = BigInt(value);
    return numericValue > ZERO && numericValue <= MAX_POSTGRES_BIGINT;
  } catch {
    return false;
  }
}

export function extractVerifiedGitHubIdentity(
  identities: readonly UserIdentity[] | undefined,
): VerifiedGitHubIdentity {
  const identity = identities?.find(
    (candidate) => candidate.provider === "github",
  );
  const githubUserId = identity?.id;
  const data = identity?.identity_data;
  const githubHandle = normalizeGitHubHandle(
    typeof data?.user_name === "string"
      ? data.user_name
      : typeof data?.preferred_username === "string"
        ? data.preferred_username
        : "",
  );

  if (
    !githubUserId ||
    !isPositivePostgresBigint(githubUserId) ||
    !githubHandle
  ) {
    throw new AppError(
      "UNAUTHORIZED",
      "A verified GitHub identity is required.",
    );
  }

  const candidateName = [data?.full_name, data?.name].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );

  return {
    githubUserId,
    githubHandle,
    displayName: (candidateName ?? githubHandle).trim().slice(0, 80),
  };
}
