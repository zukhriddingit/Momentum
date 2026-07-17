import { expect, test } from "@playwright/test";

const COMPLETION_MESSAGE =
  /Nice work — your progress earned a new milestone\.|You reached an achievement through work you completed\./;

test("new user builds and persists their first focused win", async ({
  page,
}, testInfo) => {
  const uniqueId = `${testInfo.workerIndex}-${Date.now()}`;
  const displayName = "Alex Rivera";
  const email = `momentum-${uniqueId}@example.com`;
  const password = "momentum-test-password";
  const workspaceName = "Alex's Momentum Workspace";
  const projectName = "First Focus Project";
  const taskName = "Write the project kickoff note";

  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Timezone").fill("America/New_York");
  await page
    .getByRole("button", { name: "Create my Momentum account" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Set up your team's momentum" }),
  ).toBeVisible();
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Your workspace is saved" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(
    page.getByRole("heading", { name: projectName, level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill(taskName);
  await page.getByLabel("Assignee").selectOption({ label: displayName });
  await expect(page.getByLabel("Effort")).toHaveValue("medium");
  await expect(page.getByTestId("base-point-estimate")).toContainText(
    "Estimated base reward: 40 points",
  );
  await expect(page.getByLabel("Deadline (optional)")).toHaveValue("");
  await expect(page.getByLabel("Status")).toHaveValue("todo");
  await page.getByRole("button", { name: "Create task" }).click();

  const todoColumn = page.getByRole("region", { name: "To Do" });
  await expect(
    todoColumn.getByRole("heading", { name: taskName }),
  ).toBeVisible();
  await todoColumn.getByRole("button", { name: "Choose as Focus" }).click();
  await expect(todoColumn.getByText("Today's Focus")).toBeVisible();
  await todoColumn.getByRole("button", { name: "Start task" }).click();

  const inProgressColumn = page.getByRole("region", { name: "In Progress" });
  await expect(
    inProgressColumn.getByRole("heading", { name: taskName }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await inProgressColumn.getByRole("button", { name: "Complete task" }).click();

  const celebration = page.getByTestId("completion-celebration");
  await expect(celebration).toBeVisible();
  await expect(
    celebration.getByRole("heading", { name: "40 points earned" }),
  ).toBeVisible();
  await expect(celebration.getByText("0 → 1")).toBeVisible();
  await expect(celebration).toHaveAttribute(
    "data-message-event",
    "achievement_unlocked",
  );
  await expect(celebration.getByText("First Step")).toBeVisible();
  await expect(celebration.getByText("Focused Finish")).toBeVisible();
  await expect(celebration.getByText(COMPLETION_MESSAGE)).toBeVisible();
  await expect(celebration.getByText("100%", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("completion-celebration-effect"),
  ).toHaveAttribute("data-celebration-state", "reduced");
  await expect(
    celebration.getByRole("button", { name: "Keep the momentum going" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toBeVisible();
  await page.getByRole("button", { name: "Keep the momentum going" }).click();
  await expect(page).not.toHaveURL(/[?&]celebration=/);

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Done" })
      .getByRole("heading", { name: taskName }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(
    page.getByRole("heading", { name: `Welcome back, ${displayName}` }),
  ).toBeVisible();
  await expect(page.getByTestId("total-points")).toHaveText("40");
  await expect(page.getByTestId("current-streak")).toHaveText("1");
  const achievements = page.getByTestId("dashboard-achievements");
  await expect(achievements.getByTestId("achievement-card")).toHaveCount(5);
  await expect(achievements.getByText("First Step")).toBeVisible();
  await expect(achievements.getByText("Focused Finish")).toBeVisible();
  await expect(
    achievements.getByText(/Ready when this fits your work/),
  ).toHaveCount(3);
  await expect(page.getByTestId("unread-notification-count")).toHaveText("1");
  await expect(
    page.getByTestId("point-activity").getByText(taskName),
  ).toBeVisible();
  await expect(page.getByText("1 of 1 tasks complete")).toBeVisible();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      `Your focus is “${taskName}.” Keep the next step small and clear.`,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Achievement unlocked|New milestone/,
    }),
  ).toBeVisible();
  await expect(page.getByText(COMPLETION_MESSAGE)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toHaveCount(0);
  await expect(page.getByTestId("total-points")).toHaveText("40");
  await expect(page.getByTestId("current-streak")).toHaveText("1");
  await expect(page.getByText("1 of 1 tasks complete")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Achievement unlocked|New milestone/,
    }),
  ).toBeVisible();
  await expect(page.getByText(COMPLETION_MESSAGE)).toBeVisible();
});
