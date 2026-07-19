import { expect, test } from "@playwright/test";

test("owner archives a project from the mobile project view", async ({
  page,
}, testInfo) => {
  const uniqueId = `${testInfo.workerIndex}-${Date.now()}`;
  const workspaceName = "Archive Workspace";
  const projectName = "Project Ready to Archive";

  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill("Archive Demo Owner");
  await page.getByLabel("Email").fill(`archive-owner-${uniqueId}@example.com`);
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

  await expect(
    page.getByRole("heading", { name: projectName, level: 1 }),
  ).toBeVisible();
  const projectUrl = page.url();
  await page.setViewportSize({ width: 390, height: 844 });

  const archiveTrigger = page.getByRole("button", {
    name: "Archive project",
  });
  await archiveTrigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Archive this project?",
  });
  await expect(dialog).toContainText(
    "It will leave active project views, while its tasks, points, and completion history stay preserved.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(archiveTrigger).toBeFocused();
  await archiveTrigger.click();
  await dialog.getByRole("button", { name: "Archive project" }).click();

  await expect(page).toHaveURL(/\/workspaces\/[^/?]+\?projectArchived=1$/);
  await expect(
    page.getByRole("status").filter({
      hasText: "Project archived. Its history is preserved.",
    }),
  ).toHaveText("Project archived. Its history is preserved.");
  await expect(page.getByRole("link", { name: projectName })).toHaveCount(0);
  await expect(page.getByRole("option", { name: projectName })).toHaveCount(0);

  await page.goto(projectUrl);
  await expect(
    page.getByRole("heading", { name: "That page is not available" }),
  ).toBeVisible();
});
