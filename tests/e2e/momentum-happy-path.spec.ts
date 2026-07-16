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
  await expect(celebration.getByText("2 → 3")).toBeVisible();
  await expect(
    celebration.getByText("Achievement unlocked: Momentum Three"),
  ).toBeVisible();
  await expect(
    celebration.getByText(
      "Nice work — you followed through on today’s focus and built real momentum.",
    ),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toBeVisible();
  await page.getByRole("button", { name: "Keep the momentum going" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByText("Momentum Three")).toBeVisible();
  await expect(page.getByText("3 of 4 tasks complete")).toBeVisible();
  await expect(page.getByText("75%", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Nice work — you followed through on today’s focus and built real momentum.",
    ),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByText("Momentum Three")).toBeVisible();
});
