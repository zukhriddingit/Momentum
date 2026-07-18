import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors";

const dependencies = vi.hoisted(() => ({
  addCohortSeat: vi.fn(),
  logServerEvent: vi.fn(),
  requestNow: vi.fn(),
  requireUser: vi.fn(),
  requireWorkspaceManager: vi.fn(),
  resolveCohortParticipant: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));
vi.mock("@/server/auth/require-user", () => ({
  requireUser: dependencies.requireUser,
}));
vi.mock("@/server/clock", () => ({ requestNow: dependencies.requestNow }));
vi.mock("@/server/cohort/add-cohort-seat", () => ({
  addCohortSeat: dependencies.addCohortSeat,
}));
vi.mock("@/server/cohort/github-directory", () => ({
  resolveCohortParticipant: dependencies.resolveCohortParticipant,
}));
vi.mock("@/server/observability/logger", () => ({
  logServerEvent: dependencies.logServerEvent,
}));
vi.mock("@/server/workspaces/require-workspace-manager", () => ({
  requireWorkspaceManager: dependencies.requireWorkspaceManager,
}));

import { addCohortSeatAction } from "./actions";

const actorId = "00000000-0000-4000-8000-000000000901";
const workspaceId = "00000000-0000-4000-8000-000000000902";
const seatId = "00000000-0000-4000-8000-000000000903";
const occurredAt = new Date("2026-07-18T18:00:00.000Z");
const participant = {
  githubUserId: "227412781",
  githubHandle: "kperpignant",
  profileUrl: "https://github.com/kperpignant",
  sourcePullRequestUrl:
    "https://github.com/rogerSuperBuilderAlpha/hult-cohort-program/pull/47",
  displayName: null,
};
const seat = {
  id: seatId,
  workspaceId,
  githubUserId: participant.githubUserId,
  githubHandle: participant.githubHandle,
  profileUrl: participant.profileUrl,
  userId: null,
  claimedAt: null,
};

function formData(): FormData {
  const data = new FormData();
  data.set("workspaceId", workspaceId);
  data.set("githubHandle", " KPerpignant ");
  return data;
}

describe("addCohortSeatAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireUser.mockResolvedValue({ id: actorId, email: null });
    dependencies.requireWorkspaceManager.mockResolvedValue(undefined);
    dependencies.resolveCohortParticipant.mockResolvedValue(participant);
    dependencies.requestNow.mockResolvedValue(occurredAt);
    dependencies.addCohortSeat.mockResolvedValue(seat);
  });

  it("checks manager authorization before looking up GitHub", async () => {
    dependencies.requireWorkspaceManager.mockRejectedValue(
      new AppError("NOT_FOUND", "Workspace not found."),
    );

    await expect(addCohortSeatAction(null, formData())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Workspace not found.",
    });
    expect(dependencies.resolveCohortParticipant).not.toHaveBeenCalled();
    expect(dependencies.addCohortSeat).not.toHaveBeenCalled();
  });

  it("returns supportive copy when a GitHub account cannot be verified", async () => {
    dependencies.resolveCohortParticipant.mockRejectedValue(
      new TypeError("GitHub account was not found."),
    );

    await expect(addCohortSeatAction(null, formData())).resolves.toEqual({
      ok: false,
      code: "NOT_FOUND",
      message:
        "We could not verify that GitHub account yet. Check the username or try again.",
    });
    expect(dependencies.addCohortSeat).not.toHaveBeenCalled();
  });

  it("does not disguise unrelated TypeErrors as lookup misses", async () => {
    dependencies.addCohortSeat.mockRejectedValue(
      new TypeError("Unexpected seat conversion bug."),
    );

    const result = await addCohortSeatAction(null, formData());

    expect(result).toMatchObject({
      ok: false,
      code: "INTERNAL",
      message:
        "Something interrupted that update. Your saved work is still safe.",
    });
    expect(dependencies.logServerEvent).toHaveBeenCalledOnce();
  });

  it("adds the verified participant and revalidates the workspace", async () => {
    await expect(addCohortSeatAction(null, formData())).resolves.toEqual({
      ok: true,
      data: seat,
    });
    expect(dependencies.requireWorkspaceManager).toHaveBeenCalledWith({
      actorId,
      workspaceId,
    });
    expect(dependencies.resolveCohortParticipant).toHaveBeenCalledWith(
      "kperpignant",
    );
    expect(dependencies.addCohortSeat).toHaveBeenCalledWith({
      actorId,
      workspaceId,
      participant,
      occurredAt,
    });
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}`,
    );
  });
});
