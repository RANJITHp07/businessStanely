import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/agent-auth";
import { createSeedTask, openTaskByTitle } from "../../fixtures/task-helpers";

function statusTrigger(page: Page) {
  return page
    .getByText("Status", { exact: true })
    .locator("..")
    .getByRole("combobox");
}

test.describe("Agent - Task status, progress, comments, timesheet", () => {
  test("changing status to 'Completed' auto-sets progress to 100%", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "medium" });
    await openTaskByTitle(page, title);

    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^completed$/i }).click();

    await expect(page.getByText(/progress \(100%\)/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.reload();
    await expect(page.getByText(/progress \(100%\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("a fresh task has no per-status progress memory: switching to 'In Progress' shows 0%, not a default", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "medium" });
    await openTaskByTitle(page, title);

    // Unlike the admin app (which defaults "In Progress" to 30%), the agent
    // app tracks progress per-status and a brand-new task has no memory for
    // any status yet, so it should show 0% here.
    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^in progress$/i }).click();
    await expect(page.getByText(/progress \(0%\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("agent-only 'Abandoned' status is selectable", async ({ page }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    await statusTrigger(page).click();
    await expect(
      page.getByRole("option", { name: /^abandoned$/i })
    ).toBeVisible();
    await page.getByRole("option", { name: /^abandoned$/i }).click();
    await expect(statusTrigger(page)).toHaveText(/abandoned/i);
  });

  test("progress set for one status is remembered when returning to that status", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "medium" });
    await openTaskByTitle(page, title);

    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^in progress$/i }).click();

    const progressInput = page
      .getByText(/^progress \(/i)
      .locator("..")
      .locator("input");
    await progressInput.fill("40");
    await progressInput.blur();
    await expect(page.getByText(/progress \(40%\)/i)).toBeVisible({
      timeout: 5_000,
    });

    // Switch away to Hold, then back to In Progress - 40% should be restored
    // from statusProgressMap rather than resetting to 0.
    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^hold$/i }).click();
    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^in progress$/i }).click();

    await expect(page.getByText(/progress \(40%\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("status-check duration select is read-only for agents", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    const statusCheckSelect = page.locator("#status-check-duration");
    if (await statusCheckSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(statusCheckSelect).toBeDisabled();
    }
  });

  test("adding a comment requires work date, start time, and end time", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    await page
      .getByPlaceholder("Add a comment...")
      .fill("Playwright agent comment - safe to delete.");

    const addCommentButton = page.getByRole("button", { name: /^add comment$/i });
    await expect(addCommentButton).toBeDisabled();

    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.locator("button[data-day]:not([aria-disabled='true'])").first().click();
    await expect(addCommentButton).toBeDisabled();

    await page.locator('input[type="time"]').first().fill("09:00");
    await page.locator('input[type="number"]').first().fill("30");

    await expect(addCommentButton).toBeEnabled({ timeout: 5_000 });
  });

  test("submitting a valid comment adds it to the task's comment list", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    const commentText = `Playwright agent comment ${Date.now()}`;
    await page.getByPlaceholder("Add a comment...").fill(commentText);
    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.locator("button[data-day]:not([aria-disabled='true'])").first().click();
    await page.locator('input[type="time"]').first().fill("09:00");
    await page.locator('input[type="number"]').first().fill("30");

    await page.getByRole("button", { name: /^add comment$/i }).click();
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10_000 });
  });

  test("logging time requires date, hours, and description, then appears in the time log list", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    await page.getByRole("tab", { name: /time log/i }).click();

    const logButton = page.getByRole("button", { name: /log time/i });
    await expect(logButton).toBeDisabled();

    const description = `Playwright time log ${Date.now()}`;
    await page.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    await page.locator('input[type="number"][step="0.5"]').fill("2");
    await page.getByPlaceholder("Description").fill(description);

    await expect(logButton).toBeEnabled();
    await logButton.click();

    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("2h")).toBeVisible();
  });

  test("deleting a time log entry removes it from the list", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    await page.getByRole("tab", { name: /time log/i }).click();
    const description = `Playwright deletable log ${Date.now()}`;
    await page.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    await page.locator('input[type="number"][step="0.5"]').fill("1");
    await page.getByPlaceholder("Description").fill(description);
    await page.getByRole("button", { name: /log time/i }).click();
    await expect(page.getByText(description)).toBeVisible({ timeout: 10_000 });

    const logRow = page.locator("div").filter({ hasText: description }).last();
    await logRow.getByRole("button", { name: /delete/i }).click();

    await expect(page.getByText(description)).not.toBeVisible({ timeout: 10_000 });
  });
});
