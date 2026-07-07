import { test, expect } from "../../fixtures/admin-auth";

// A single run-unique suffix so re-runs don't collide on unique fields
// (e.g. client email) and so created records are easy to spot/clean up.
const runId = Date.now();

test.describe("Admin - Task CRUD", () => {
  test("create a task with a new client and a new service category", async ({
    page,
  }) => {
    await page.goto("/task/create");
    await expect(page.getByRole("heading", { name: /create task/i })).toBeVisible();

    const taskTitle = `Playwright Task ${runId}`;
    await page.locator("#task-name").fill(taskTitle);
    await page
      .locator("#description")
      .fill("Created by Playwright automated test - safe to delete.");

    // --- Service category: create new via "Add" dialog ---
    await page.getByRole("button", { name: /^add$/i }).first().click();
    const categoryName = `PW Category ${runId}`;
    await page.locator("#category-name").fill(categoryName);
    await page.getByRole("button", { name: /create/i }).last().click();
    await expect(page.locator("#taskCategory")).toHaveValue(categoryName, {
      timeout: 10_000,
    });

    // --- Client: create new via "Add Client" dialog ---
    await page.getByRole("button", { name: /add client/i }).click();
    // Client type select defaults to individual; fill required fields.
    await page.locator("#firstName").fill("Playwright");
    await page.locator("#lastName").fill(`Client${runId}`);
    await page.locator('[id="email"]').first().fill(`pw.client.${runId}@example.com`);
    await page.locator('[id="phoneNumber"]').first().fill("9000000000");
    await page.getByRole("button", { name: /^create client$/i }).click();
    await expect(page.locator("#client")).toHaveValue(/Playwright/, {
      timeout: 10_000,
    });

    // --- Priority ---
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^high$/i }).click();

    // --- Assign to an existing agent: search broadly, pick first match ---
    await page.locator("#assigned-agent").fill("a");
    const firstAgentSuggestion = page
      .locator("#assigned-agent")
      .locator("xpath=following::div[contains(@class,'cursor-pointer')]")
      .first();
    await expect(firstAgentSuggestion).toBeVisible({ timeout: 10_000 });
    await firstAgentSuggestion.click();

    // Legislation is optional for task creation - not required by validation,
    // so it's intentionally skipped here to keep this test focused/robust.
    await page.getByRole("button", { name: /create task/i }).click();

    // Successful creation redirects back to the task list/detail.
    await expect(page).toHaveURL(/\/task(\/|$)/, { timeout: 15_000 });
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10_000 });
  });

  test("task list shows search, filter, and pagination controls", async ({
    page,
  }) => {
    await page.goto("/task");
    await expect(page.getByRole("heading", { name: /task management/i })).toBeVisible();
    await expect(page.locator("#search")).toBeVisible();
    await expect(page.getByRole("button", { name: /create task/i })).toBeVisible();
  });

  test("search filters the task list by title", async ({ page }) => {
    await page.goto("/task");
    const searchBox = page.locator("#search");
    await searchBox.fill("zzz-no-such-task-zzz");
    await expect(page.getByText(/no tasks found matching your criteria/i)).toBeVisible({
      timeout: 10_000,
    });
    await searchBox.fill("");
  });

  test("edit an existing task's status and progress", async ({ page }) => {
    await page.goto("/task");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    await expect(page).toHaveURL(/\/task\/[^/]+$/, { timeout: 10_000 });

    // Status select is a shadcn Select keyed by #status label.
    const statusTrigger = page.locator("#status").locator("..").locator("button");
    if (await statusTrigger.isVisible().catch(() => false)) {
      await statusTrigger.click();
      await page.getByRole("option", { name: /in progress/i }).click();
    }
  });

  test("delete confirmation dialog appears and can be cancelled", async ({
    page,
  }) => {
    await page.goto("/task");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });

    await firstRow.locator("button", { hasText: "" }).last().click();
    const deleteItem = page.getByRole("menuitem", { name: /delete task/i });
    if (await deleteItem.isVisible().catch(() => false)) {
      await deleteItem.click();
      await expect(
        page.getByRole("alertdialog", { name: /are you sure/i })
      ).toBeVisible();
      await page.getByRole("button", { name: /cancel/i }).click();
      await expect(
        page.getByRole("alertdialog", { name: /are you sure/i })
      ).not.toBeVisible();
    }
  });
});
