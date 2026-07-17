import { expect, test } from "@playwright/test";

import { demoNudgeDueAt, demoWorkdayInstant } from "../fixtures/demo";
import { PLAYWRIGHT_JOB_SECRET } from "../fixtures/self-service";

const MINIMAL_ACHIEVEMENT_MESSAGE =
  /New milestone recorded\.|Achievement added\./;
const MINIMAL_DEADLINE_MESSAGE =
  /Deadline is within 24 hours\.|Choose the next task step\./;

test("personal motivation settings persist across completions and deadline nudges", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000);

  const uniqueId = `${testInfo.workerIndex}-${Date.now()}`;
  const displayName = "Sam Taylor";
  const email = `motivation-${uniqueId}@example.com`;
  const password = "momentum-test-password";
  const workspaceName = "Sam's Momentum Workspace";
  const projectName = "Motivation Experience";
  const completedTaskName = "Capture the first customer note";
  const deadlineTaskName = "Prepare tomorrow's team check-in";

  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Timezone").fill("America/New_York");
  await page
    .getByRole("button", { name: "Create my Momentum account" })
    .click();

  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.getByRole("heading", { name: projectName, level: 1 }),
  ).toBeVisible();
  const projectUrl = page.url();

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Message tone").selectOption("minimal");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page.reload();
  await expect(page.getByLabel("Message tone")).toHaveValue("minimal");

  await page.goto(projectUrl);
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill(completedTaskName);
  await page.getByLabel("Assignee").selectOption({ label: displayName });
  await page.getByRole("button", { name: "Create task" }).click();

  const todoColumn = page.getByRole("region", { name: "To Do" });
  const completedTask = todoColumn.getByRole("heading", {
    name: completedTaskName,
  });
  await expect(completedTask).toBeVisible();
  await todoColumn.getByRole("button", { name: "Choose as Focus" }).click();
  await todoColumn.getByRole("button", { name: "Start task" }).click();
  const inProgressColumn = page.getByRole("region", { name: "In Progress" });
  await inProgressColumn.getByRole("button", { name: "Complete task" }).click();

  const celebration = page.getByTestId("completion-celebration");
  await expect(celebration).toHaveAttribute("data-message-tone", "minimal");
  await expect(celebration).toHaveAttribute(
    "data-message-event",
    "achievement_unlocked",
  );
  await expect(
    celebration.getByRole("heading", { name: "40 points earned" }),
  ).toBeVisible();
  await expect(celebration.getByText("First Step")).toBeVisible();
  await expect(celebration.getByText("Focused Finish")).toBeVisible();
  const persistedMessage = celebration.getByText(MINIMAL_ACHIEVEMENT_MESSAGE);
  await expect(persistedMessage).toBeVisible();
  const messageBody = await persistedMessage.textContent();

  await page.reload();
  const reloadedCelebration = page.getByTestId("completion-celebration");
  await expect(reloadedCelebration).toHaveAttribute(
    "data-message-tone",
    "minimal",
  );
  await expect(reloadedCelebration.getByText(messageBody ?? "")).toBeVisible();
  await reloadedCelebration
    .getByRole("button", { name: "Keep the momentum going" })
    .click();

  const bell = page.getByRole("button", { name: "Notifications, 1 unread" });
  await bell.click();
  const preview = page.getByRole("region", { name: "Recent notifications" });
  await expect(preview.getByText(messageBody ?? "")).toBeVisible();
  await preview.getByRole("link", { name: "View all notifications" }).click();
  await expect(
    page.getByRole("heading", { name: "Notifications", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark read" }).click();
  await expect(page.getByRole("button", { name: "Mark read" })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeVisible();

  await page.goto(projectUrl);
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill(deadlineTaskName);
  await page.getByLabel("Assignee").selectOption({ label: displayName });
  await page
    .getByLabel("Deadline (optional)")
    .fill(demoNudgeDueAt().toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Create task" }).click();

  const jobHeaders = {
    authorization: `Bearer ${PLAYWRIGHT_JOB_SECRET}`,
    "x-momentum-test-now": demoWorkdayInstant().toISOString(),
  };
  const unauthorizedScan = await request.post("/api/jobs/deadline-nudges", {
    headers: {
      authorization: "Bearer incorrect-secret",
      "x-momentum-test-now": demoWorkdayInstant().toISOString(),
    },
  });
  expect(unauthorizedScan.status()).toBe(401);
  const firstScan = await request.post("/api/jobs/deadline-nudges", {
    headers: jobHeaders,
  });
  expect(firstScan.ok()).toBe(true);
  expect(await firstScan.json()).toEqual({ scannedCount: 2, createdCount: 2 });
  const retryScan = await request.post("/api/jobs/deadline-nudges", {
    headers: jobHeaders,
  });
  expect(retryScan.ok()).toBe(true);
  expect(await retryScan.json()).toEqual({ scannedCount: 2, createdCount: 0 });

  await page.goto("/notifications");
  await expect(
    page.getByRole("button", { name: "Notifications, 1 unread" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Due soon|Deadline approaching/ }),
  ).toHaveCount(1);
  await expect(page.getByText(MINIMAL_DEADLINE_MESSAGE)).toHaveCount(1);
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(
    page.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Mark all as read" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Show achievements").uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("total-points")).toHaveText("40");
  await expect(page.getByTestId("dashboard-achievements")).toHaveCount(0);
});
