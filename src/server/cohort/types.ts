export interface CohortDirectoryEntry {
  githubUserId: string;
  githubHandle: string;
  profileUrl: string;
  sourcePullRequestUrl: string | null;
  displayName: string | null;
}

export interface CohortDirectoryView {
  entries: CohortDirectoryEntry[];
  source: "github" | "snapshot";
  synchronizedAt: string;
}

export interface CohortSeatView {
  id: string;
  workspaceId: string;
  githubUserId: string;
  githubHandle: string;
  profileUrl: string;
  userId: string | null;
  claimedAt: string | null;
}

export interface CohortClaimReceipt {
  workspaceIds: string[];
  claimedSeatCount: number;
  activatedTaskCount: number;
}
