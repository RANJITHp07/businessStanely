import { test, expect } from "../../fixtures/admin-auth";
import { createSeedTask, uniqueId } from "../../fixtures/task-helpers";

test.describe("Admin - Task edit side effects", () => {
  test("changing a task's category on edit recalculates its due date", async ({
    page,
  }) => {
    const id = uniqueId();

    // Create a second category with a distinctly different time period so a
    // due-date change (if any) is unambiguous.
    await page.goto("/task_category/create");
    const longCategoryName = `PW Long Period Category ${id}`;
    await page.locator("#username").fill(longCategoryName);
    await page.locator("#timePeriod").fill("30");
    await page.getByRole("button", { name: /create service/i }).click();

    const title = await createSeedTask(page, { priority: "medium" });

    await page.goto("/task");
    await page.locator("#search").fill(title);
    const row = page.locator("table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit task$/i }).click();
    await expect(page).toHaveURL(/\/task\/[^/]+\/edit$/, { timeout: 10_000 });

    const dueDateButton = page.getByText(
      /select completion date|due:/i
    ).first();
    const dueDateTextBefore = await dueDateButton.textContent();

    // Switch to the long-period category.
    await page.locator("#taskCategory").fill(longCategoryName);
    const suggestion = page.getByText(longCategoryName, { exact: true }).first();
    await suggestion.click();

    const dueDateTextAfter = await page
      .getByText(/select completion date|due:/i)
      .first()
      .textContent();

    // The due date should have changed to reflect the new category's
    // 30-day time period, rather than silently keeping the old due date.
    expect(dueDateTextAfter).not.toEqual(dueDateTextBefore);
  });

  test("editing a task allows setting a due date in the past (unlike create)", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });

    await page.goto("/task");
    await page.locator("#search").fill(title);
    const row = page.locator("table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit task$/i }).click();
    await expect(page).toHaveURL(/\/task\/[^/]+\/edit$/, { timeout: 10_000 });

    const dueDateButton = page
      .locator("button")
      .filter({ hasText: /select completion date|,/ })
      .first();
    await dueDateButton.click();

    // Navigate the calendar back a month and pick a day - past dates should
    // be selectable in edit mode.
    const prevMonthButton = page.getByRole("button", {
      name: /previous month/i,
    });
    if (await prevMonthButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await prevMonthButton.click();
    }
    await page
      .locator("button[data-day]:not([aria-disabled='true'])")
      .first()
      .click();

    await page.getByRole("button", { name: /update task/i }).click();
    // A successful update should not bounce back to the edit form with a
    // validation error about past due dates.
    await expect(page.getByText(/due date cannot be in the past/i)).not.toBeVisible();
  });

  test("legislation field remains disabled/read-only in edit mode", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });

    await page.goto("/task");
    await page.locator("#search").fill(title);
    const row = page.locator("table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit task$/i }).click();
    await expect(page).toHaveURL(/\/task\/[^/]+\/edit$/, { timeout: 10_000 });

    await expect(page.locator("#legislation")).toBeDisabled();
  });

  test("'trigger only once' checkbox is not shown when editing an existing task", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });

    await page.goto("/task");
    await page.locator("#search").fill(title);
    const row = page.locator("table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit task$/i }).click();
    await expect(page).toHaveURL(/\/task\/[^/]+\/edit$/, { timeout: 10_000 });

    await page.locator("#recurring").click();
    await page.getByRole("option", { name: /every 1 week/i }).click();

    await expect(
      page.getByText(/task will be created only on the trigger date/i)
    ).not.toBeVisible();
  });
});
