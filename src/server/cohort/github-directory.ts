import "server-only";

import { unstable_cache } from "next/cache";
import { z } from "zod";

import { normalizeGitHubHandle } from "@/domain/cohort/github-handle";
import snapshotJson from "@/server/cohort/cohort-snapshot.json";
import { parseProjectOnePulls } from "@/server/cohort/parse-project-pulls";
import type {
  CohortDirectoryEntry,
  CohortDirectoryView,
} from "@/server/cohort/types";

type Fetcher = typeof fetch;

const PULLS_URL =
  "https://api.github.com/repos/rogerSuperBuilderAlpha/hult-cohort-program/pulls?state=all&per_page=100";
const entrySchema = z.object({
  githubUserId: z.string().regex(/^\d+$/),
  githubHandle: z
    .string()
    .refine((value) => normalizeGitHubHandle(value) === value),
  profileUrl: z.url(),
  sourcePullRequestUrl: z.url().nullable(),
  displayName: z.string().nullable(),
});
const snapshotSchema = z.object({
  synchronizedAt: z.iso.datetime(),
  entries: z.array(entrySchema),
});
const userSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  login: z.string(),
  html_url: z.url(),
  name: z.string().nullable(),
});

function headers(): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_DIRECTORY_TOKEN) {
    result.Authorization = `Bearer ${process.env.GITHUB_DIRECTORY_TOKEN}`;
  }
  return result;
}

function snapshot(): CohortDirectoryView {
  const parsed = snapshotSchema.parse(snapshotJson);
  return {
    entries: parsed.entries,
    source: "snapshot",
    synchronizedAt: parsed.synchronizedAt,
  };
}

export async function loadCohortDirectory(input: {
  fetcher: Fetcher;
  forceSnapshot: boolean;
}): Promise<CohortDirectoryView> {
  if (input.forceSnapshot) return snapshot();

  try {
    const response = await input.fetcher(PULLS_URL, { headers: headers() });
    if (!response.ok) throw new Error("GitHub directory request failed.");

    const entries = parseProjectOnePulls(await response.json());
    if (entries.length === 0) throw new Error("GitHub directory was empty.");

    return {
      entries,
      source: "github",
      synchronizedAt: new Date().toISOString(),
    };
  } catch {
    return snapshot();
  }
}

const cachedDirectory = unstable_cache(
  () =>
    loadCohortDirectory({
      fetcher: fetch,
      forceSnapshot: process.env.MOMENTUM_ENVIRONMENT === "test",
    }),
  ["hult-project-one-cohort-directory"],
  { revalidate: 900 },
);

export function getCohortDirectory(): Promise<CohortDirectoryView> {
  return cachedDirectory();
}

export async function resolveCohortParticipantWith(
  value: string,
  dependencies: { directory: CohortDirectoryView; fetcher: Fetcher },
): Promise<CohortDirectoryEntry> {
  const handle = normalizeGitHubHandle(value);
  if (!handle) throw new TypeError("GitHub handle is invalid.");

  const known = dependencies.directory.entries.find(
    (entry) => entry.githubHandle === handle,
  );
  if (known) return known;

  const response = await dependencies.fetcher(
    `https://api.github.com/users/${encodeURIComponent(handle)}`,
    { headers: headers() },
  );
  if (response.status === 404) {
    throw new TypeError("GitHub account was not found.");
  }
  if (!response.ok) {
    throw new Error("GitHub account lookup is temporarily unavailable.");
  }

  const user = userSchema.parse(await response.json());
  const verifiedHandle = normalizeGitHubHandle(user.login);
  if (!verifiedHandle) {
    throw new TypeError("GitHub account response was invalid.");
  }

  return {
    githubUserId: String(user.id),
    githubHandle: verifiedHandle,
    profileUrl: user.html_url,
    sourcePullRequestUrl: null,
    displayName: user.name,
  };
}

export async function resolveCohortParticipant(
  value: string,
): Promise<CohortDirectoryEntry> {
  return resolveCohortParticipantWith(value, {
    directory: await getCohortDirectory(),
    fetcher: fetch,
  });
}
