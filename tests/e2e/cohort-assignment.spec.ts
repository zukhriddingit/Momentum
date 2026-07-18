import { expect, test } from "@playwright/test";

test("owner assigns a pending cohort participant and filters the board", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.workerIndex}-${Date.now()}`;
  const workspaceName = "Cohort Assignment Workspace";
  const projectName = "Peer Demo Project";
  const taskName = "Review the demo story";

  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill("Cohort Demo Owner");
  await page.getByLabel("Email").fill(`cohort-owner-${suffix}@example.com`);
  await page.getByLabel("Password").fill("momentum-test-password");
  await page.getByLabel("Timezone").fill("America/New_York");
  await page
    .getByRole("button", { name: "Create my Momentum account" })
    .click();

  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("button", { name: "Create your first project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("link", { name: workspaceName }).click();
  await page.getByRole("button", { name: "Add cohort member" }).click();
  await page.getByLabel("Name or GitHub username").fill("kperpignant");
  await page
    .getByRole("button", { name: /kperpignant/i })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Verify and add @kperpignant" })
    .click();
  await expect(
    page.getByText("Waiting for @kperpignant to join"),
  ).toBeVisible();

  await page.getByRole("link", { name: projectName }).click();
  await page.getByRole("button", { name: "Create task" }).click();
  await page.getByLabel("Title").fill(taskName);
  await page
    .getByLabel("Assignee", { exact: true })
    .selectOption({ label: "@kperpignant — awaiting GitHub sign-in" });
  await expect(page.getByLabel("Status")).toHaveValue("todo");
  await page.getByRole("button", { name: "Create task" }).click();

  const card = page.getByTestId(/task-/).filter({ hasText: taskName });
  const todoColumn = page.getByRole("region", { name: "To Do" });
  await expect(
    todoColumn.getByRole("heading", { name: taskName }),
  ).toBeVisible();
  await expect(card.getByText("Waiting for GitHub sign-in")).toBeVisible();
  await expect(
    card.getByRole("button", {
      name: /Choose as Focus|Start task|Complete task|Reopen task|Back to To Do/,
    }),
  ).toHaveCount(0);

  await page
    .getByLabel("Assignee filter")
    .selectOption({ label: "@kperpignant" });
  await expect(card).toBeVisible();
  await page.getByLabel("Assignee filter").selectOption({ label: "Me" });
  await expect(card).toHaveCount(0);
});
