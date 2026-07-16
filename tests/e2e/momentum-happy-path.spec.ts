import { expect, test } from "@playwright/test";

import { DEMO } from "../fixtures/demo";

test("seeded user completes today's Focus Task and sees persisted momentum", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Continue to Momentum" }).click();

  await expect(
    page.getByRole("heading", { name: /Welcome back, Maya Chen/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Launch Week/ }).click();

  const task = page.getByTestId(`task-${DEMO.candidateTaskId}`);
  await task.getByRole("button", { name: "Choose as Focus" }).click();
  await expect(task.getByText("Today's Focus")).toBeVisible();
  await task.getByRole("button", { name: "Start task" }).click();

  const movedTask = page.getByTestId(`task-${DEMO.candidateTaskId}`);
  await expect(movedTask).toBeVisible();
  await movedTask.getByRole("button", { name: "Complete task" }).click();

  const celebration = page.getByTestId("completion-celebration");
  await expect(celebration).toBeVisible();
  await expect(
    celebration.getByRole("heading", { name: "52 points earned" }),
  ).toBeVisible();
  await expect(celebration.getByText("Prepare launch brief")).toBeVisible();
  await expect(celebration).toHaveAttribute(
    "data-message-event",
    "achievement_unlocked",
  );
  await expect(celebration.getByText("2 → 3")).toBeVisible();
  await expect(celebration.getByText("Momentum Three")).toBeVisible();
  await expect(celebration.getByText("Ahead of Schedule")).toBeVisible();
  await expect(celebration.getByText("40", { exact: true })).toBeVisible();
  await expect(celebration.getByText("+8", { exact: true })).toBeVisible();
  await expect(celebration.getByText("+4", { exact: true })).toBeVisible();
  await expect(
    celebration.getByText(
      /Nice work — your progress earned a new milestone\.|You reached an achievement through work you completed\./,
    ),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toBeVisible();
  await page.getByRole("button", { name: "Keep the momentum going" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  const achievements = page.getByTestId("dashboard-achievements");
  await expect(achievements.getByTestId("achievement-card")).toHaveCount(5);
  await expect(achievements.getByText("Momentum Three")).toBeVisible();
  await expect(achievements.getByText("Ahead of Schedule")).toBeVisible();
  await expect(achievements.getByText("Five-Day Flow")).toBeVisible();
  await expect(
    achievements.getByText(/Ready when this fits your work/),
  ).toHaveCount(1);
  await expect(page.getByTestId("unread-notification-count")).toHaveText("1");
  const activity = page.getByTestId("point-activity");
  await expect(activity.getByText("Prepare launch brief")).toBeVisible();
  await expect(activity.getByText("52 points")).toBeVisible();
  await expect(activity.getByText("Base 40")).toBeVisible();
  await expect(activity.getByText("Early +8")).toBeVisible();
  await expect(activity.getByText("Streak +4")).toBeVisible();
  await expect(page.getByText("3 of 4 tasks complete")).toBeVisible();
  await expect(page.getByText("75%", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      /Nice work — your progress earned a new milestone\.|You reached an achievement through work you completed\./,
    ),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(
    page.getByTestId("dashboard-achievements").getByText("Momentum Three"),
  ).toBeVisible();
});
