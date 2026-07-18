import { GitPullRequest, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCohortMemberDialog } from "@/features/cohort/add-cohort-member-dialog";
import type { CohortDirectoryView } from "@/server/cohort/types";
import type {
  MembershipRole,
  PendingCohortSeatView,
  WorkspaceMemberView,
} from "@/server/types";

function roleLabel(role: MembershipRole): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function snapshotLabel(synchronizedAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(synchronizedAt));
}

export function TeamSection({
  workspaceId,
  actorRole,
  members,
  pendingCohortSeats,
  directory,
}: {
  workspaceId: string;
  actorRole: MembershipRole;
  members: WorkspaceMemberView[];
  pendingCohortSeats: PendingCohortSeatView[];
  directory: CohortDirectoryView | null;
}) {
  const canManage = actorRole === "owner" || actorRole === "admin";

  return (
    <section aria-labelledby="workspace-team-heading" className="mb-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <CardTitle
                id="workspace-team-heading"
                className="flex items-center gap-2"
              >
                <Users className="size-5 text-violet-600" aria-hidden="true" />
                Team
              </CardTitle>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                See who is contributing and welcome cohort participants before
                assigning their first task.
              </p>
            </div>
            {canManage && directory ? (
              <AddCohortMemberDialog
                workspaceId={workspaceId}
                directory={directory}
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <li
                key={member.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {member.displayName}
                    </p>
                    {member.githubHandle ? (
                      <a
                        href={`https://github.com/${member.githubHandle}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 inline-flex items-center gap-1 text-sm text-violet-700 hover:underline focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                      >
                        <GitPullRequest
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        @{member.githubHandle}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">
                        Momentum member
                      </p>
                    )}
                  </div>
                  <Badge>{roleLabel(member.role)}</Badge>
                </div>
              </li>
            ))}
            {pendingCohortSeats.map((seat) => (
              <li
                key={seat.id}
                className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={seat.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex max-w-full items-center gap-1 font-semibold text-violet-800 hover:underline focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                    >
                      <GitPullRequest
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">@{seat.githubHandle}</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Waiting for @{seat.githubHandle} to join
                    </p>
                  </div>
                  <Badge className="bg-violet-100 text-violet-800">
                    Pending
                  </Badge>
                </div>
              </li>
            ))}
          </ul>

          {directory?.source === "snapshot" ? (
            <p className="mt-4 text-xs text-slate-500">
              Cohort directory snapshot updated
              <time className="ml-1" dateTime={directory.synchronizedAt}>
                {snapshotLabel(directory.synchronizedAt)} UTC
              </time>
              . Exact GitHub usernames are still verified when added.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
