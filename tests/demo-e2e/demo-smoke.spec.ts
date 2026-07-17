import { expect, test } from "@playwright/test";

import { PLAYWRIGHT_JOB_SECRET } from "../fixtures/self-service";

const CANDIDATE_ID = "40000000-0000-4000-8000-000000000001";
const DUE_SOON_ID = "40000000-0000-4000-8000-000000000002";
const FRIENDLY_DEADLINE_MESSAGES = [
  {
    title: "Due soon",
    body: "This task is due within 24 hours. What is the smallest useful next step?",
  },
  {
    title: "A deadline is close",
    body: "A quick next step can make this task easier to finish.",
  },
] as const;
const SUPPORTIVE_MESSAGE =
  /Nice work — your progress earned a new milestone\.|You reached an achievement through work you completed\./;

function required(name: "MOMENTUM_DEMO_EMAIL" | "MOMENTUM_DEMO_PASSWORD") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

test("clean guided demo persists momentum and stays idempotent", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({
    status: "ok",
    environment: "test",
  });
  expect(health.headers()["x-request-id"]).toBeTruthy();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(required("MOMENTUM_DEMO_EMAIL"));
  await page.getByLabel("Password").fill(required("MOMENTUM_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Continue to Momentum" }).click();
  await page.getByRole("link", { name: /Launch Week/ }).click();
  await expect(
    page.getByRole("heading", { name: "Launch Week", level: 1 }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/projects\/[^/]+$/);
  const projectUrl = page.url();

  const todoTask = page.getByTestId(`task-${CANDIDATE_ID}`);
  await todoTask.getByRole("button", { name: "Choose as Focus" }).click();
  await expect(todoTask.getByText("Today's Focus")).toBeVisible();
  await todoTask.getByRole("button", { name: "Start task" }).click();

  const inProgressTask = page.getByTestId(`task-${CANDIDATE_ID}`);
  await expect(inProgressTask).toHaveAttribute("data-start-pulse", "active");
  await inProgressTask.getByRole("button", { name: "Complete task" }).click();

  const celebration = page.getByTestId("completion-celebration");
  await expect(
    celebration.getByRole("heading", { name: "52 points earned" }),
  ).toBeVisible();
  await expect(celebration.getByText("40", { exact: true })).toBeVisible();
  await expect(celebration.getByText("+8", { exact: true })).toBeVisible();
  await expect(celebration.getByText("+4", { exact: true })).toBeVisible();
  await expect(celebration.getByText("2 → 3")).toBeVisible();
  await expect(celebration.getByText("Momentum Three")).toBeVisible();
  await expect(celebration.getByText("Ahead of Schedule")).toBeVisible();
  await expect(celebration.getByText(SUPPORTIVE_MESSAGE)).toBeVisible();
  await expect(
    page.getByTestId("completion-celebration-effect"),
  ).toHaveAttribute("data-celebration-state", "fired");

  await page.reload();
  await expect(page.getByTestId("completion-celebration")).toBeVisible();
  await expect(
    page.getByTestId("completion-celebration-effect"),
  ).toHaveAttribute("data-celebration-state", "seen");
  await page.getByRole("button", { name: "Keep the momentum going" }).click();
  await page.getByRole("link", { name: "Dashboard" }).click();

  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByText("3 of 4 tasks complete")).toBeVisible();
  await expect(page.getByText("75%", { exact: true })).toBeVisible();
  await expect(page.getByTestId("unread-notification-count")).toHaveText("1");
  await expect(
    page.getByTestId("dashboard-achievements").getByText("Momentum Three"),
  ).toBeVisible();
  await expect(
    page.getByTestId("dashboard-achievements").getByText("Ahead of Schedule"),
  ).toBeVisible();
  await expect(
    page.getByTestId("point-activity").getByText("52 points"),
  ).toBeVisible();
  await expect(page.getByText(SUPPORTIVE_MESSAGE)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByText("3 of 4 tasks complete")).toBeVisible();

  const jobHeaders = {
    authorization: `Bearer ${PLAYWRIGHT_JOB_SECRET}`,
  };
  const firstScan = await request.post("/api/jobs/deadline-nudges", {
    headers: jobHeaders,
  });
  const retryScan = await request.post("/api/jobs/deadline-nudges", {
    headers: jobHeaders,
  });
  expect(await firstScan.json()).toEqual({ scannedCount: 1, createdCount: 1 });
  expect(await retryScan.json()).toEqual({ scannedCount: 1, createdCount: 0 });
  await page.goto("/notifications");
  const dueSoonNotification = page.getByRole("listitem").filter({
    has: page.locator(`a[href$="#task-${DUE_SOON_ID}"]`),
  });
  await expect(dueSoonNotification).toHaveCount(1);
  const dueSoonLink = dueSoonNotification.locator(
    `a[href$="#task-${DUE_SOON_ID}"]`,
  );
  const dueSoonTitle = (await dueSoonLink.textContent())?.trim();
  const friendlyDeadlineMessage = FRIENDLY_DEADLINE_MESSAGES.find(
    (message) => message.title === dueSoonTitle,
  );
  expect(friendlyDeadlineMessage).toBeDefined();
  await expect(
    dueSoonNotification.getByText(friendlyDeadlineMessage!.body, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeVisible();

  await page.goto(projectUrl);
  const doneTask = page.getByTestId(`task-${CANDIDATE_ID}`);
  await doneTask.getByRole("button", { name: "Reopen task" }).click();
  await page
    .getByTestId(`task-${CANDIDATE_ID}`)
    .getByRole("button", { name: "Complete task" })
    .click();
  const recompletedTask = page
    .getByRole("region", { name: "Done" })
    .getByTestId(`task-${CANDIDATE_ID}`);
  await expect(
    recompletedTask.getByRole("button", { name: "Reopen task" }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]celebration=/);
  await expect(page.getByTestId("completion-celebration")).toHaveCount(0);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("total-points")).toHaveText("93");
  await expect(page.getByTestId("current-streak")).toHaveText("3");
  await expect(page.getByTestId("unread-notification-count")).toHaveText("2");
});
