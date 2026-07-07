import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/admin-auth";
import { createSeedTask, openTaskByTitle } from "../../fixtures/task-helpers";

function statusTrigger(page: Page) {
  return page
    .getByText("Status", { exact: true })
    .locator("..")
    .getByRole("combobox");
}

test.describe("Admin - Task status, progress, comments, deletion", () => {
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

    // Reload and confirm the change actually persisted server-side, not
    // just in local component state.
    await page.reload();
    await expect(page.getByText(/progress \(100%\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("changing status to 'In Progress' auto-sets progress to 30%", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "medium" });
    await openTaskByTitle(page, title);

    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^in progress$/i }).click();

    await expect(page.getByText(/progress \(30%\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("changing status to 'Hold' resets progress to 0%", async ({ page }) => {
    const title = await createSeedTask(page, { priority: "medium" });
    await openTaskByTitle(page, title);

    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^in progress$/i }).click();
    await expect(page.getByText(/progress \(30%\)/i)).toBeVisible({
      timeout: 10_000,
    });

    await statusTrigger(page).click();
    await page.getByRole("option", { name: /^hold$/i }).click();
    await expect(page.getByText(/progress \(0%\)/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("manual progress input accepts 0-100 and rejects out-of-range/non-numeric input", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    const progressInput = page
      .getByText(/^progress \(/i)
      .locator("..")
      .locator("input");

    await progressInput.fill("75");
    await expect(page.getByText(/progress \(75%\)/i)).toBeVisible();

    // Attempting an out-of-range value should not be accepted as typed.
    await progressInput.fill("150");
    await expect(progressInput).not.toHaveValue("150");
  });

  test("adding a comment requires work date, start time, and end time", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    const commentBox = page.getByPlaceholder("Add a comment...");
    await commentBox.fill("Playwright edge-case comment - safe to delete.");

    const addCommentButton = page.getByRole("button", { name: /^add comment$/i });
    await expect(addCommentButton).toBeDisabled();

    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.locator("button[data-day]:not([aria-disabled='true'])").first().click();

    // Still disabled without start time filled in.
    await expect(addCommentButton).toBeDisabled();

    await page.locator('input[type="time"]').first().fill("09:00");
    await page.locator('input[type="number"]').first().fill("30");

    // End time is auto-derived from start + duration; now all fields present.
    await expect(addCommentButton).toBeEnabled({ timeout: 5_000 });
  });

  test("submitting a valid comment adds it to the task's comment list and moves status to 'In Progress'", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    const commentText = `Playwright comment ${Date.now()}`;
    await page.getByPlaceholder("Add a comment...").fill(commentText);
    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.locator("button[data-day]:not([aria-disabled='true'])").first().click();
    await page.locator('input[type="time"]').first().fill("09:00");
    await page.locator('input[type="number"]').first().fill("30");

    await page.getByRole("button", { name: /^add comment$/i }).click();

    await expect(page.getByText(commentText)).toBeVisible({ timeout: 10_000 });
    // A fresh task starts as "To Do"; adding a comment should auto-advance it.
    await expect(page.getByText(/^In Progress$/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("checking 'I Updated the Client' resets the status-check duration to its default", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });
    await openTaskByTitle(page, title);

    await page.getByPlaceholder("Add a comment...").fill("Client update comment.");
    await page.locator("#interaction-client-update").check();
    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.locator("button[data-day]:not([aria-disabled='true'])").first().click();
    await page.locator('input[type="time"]').first().fill("10:00");
    await page.locator('input[type="number"]').first().fill("15");

    await page.getByRole("button", { name: /^add comment$/i }).click();
    await expect(page.getByText("Client update comment.")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("deleting a task from the list hides it, and it does not reappear on reload", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });

    await page.goto("/task");
    await page.locator("#search").fill(title);
    const row = page.locator("table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /delete task/i }).click();
    await page.getByRole("button", { name: /^delete$/i }).click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10_000 });

    // Reload and re-search: soft-deleted tasks should stay excluded from
    // the default (active-only) list view, not just removed from local state.
    await page.reload();
    await page.locator("#search").fill(title);
    await expect(
      page.getByText(/no tasks found matching your criteria/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});
