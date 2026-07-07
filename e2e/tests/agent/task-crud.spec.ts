import { test, expect } from "../../fixtures/agent-auth";

const runId = Date.now();

test.describe("Agent - Task CRUD", () => {
  test("create a task with a new client and a new service category", async ({
    page,
  }) => {
    await page.goto("/task/create");

    const taskTitle = `Playwright Agent Task ${runId}`;
    await page.locator("#task-name").fill(taskTitle);
    await page
      .locator("#description")
      .fill("Created by Playwright automated test - safe to delete.");

    // --- Service category: create new via "Add" dialog ---
    await page.getByRole("button", { name: /^add$/i }).first().click();
    const categoryName = `PW Agent Category ${runId}`;
    await page.locator("#category-name").fill(categoryName);
    await page.getByRole("button", { name: /create/i }).last().click();
    await expect(page.locator("#taskCategory")).toHaveValue(categoryName, {
      timeout: 10_000,
    });

    // --- Client: create new via "Add Client" dialog ---
    await page.getByRole("button", { name: /add client/i }).click();
    await page.locator("#firstName").fill("Playwright");
    await page.locator("#lastName").fill(`AgentClient${runId}`);
    await page.locator('[id="email"]').first().fill(`pw.agentclient.${runId}@example.com`);
    await page.locator('[id="phoneNumber"]').first().fill("9000000001");
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

    // Legislation is optional for task creation - intentionally skipped.
    await page.getByRole("button", { name: /create task/i }).click();

    await expect(page).toHaveURL(/\/task(\/|$)/, { timeout: 15_000 });
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 10_000 });
  });

  test("task list shows search and create controls", async ({ page }) => {
    await page.goto("/task");
    await expect(page.getByRole("heading", { name: /task management/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create task/i })).toBeVisible();
  });

  test("search filters the task list by title", async ({ page }) => {
    await page.goto("/task");
    const searchBox = page.locator("#search");
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.fill("zzz-no-such-task-zzz");
      await expect(
        page.getByText(/no tasks found matching your criteria/i)
      ).toBeVisible({ timeout: 10_000 });
      await searchBox.fill("");
    }
  });

  test("open an existing task's detail view", async ({ page }) => {
    await page.goto("/task");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/task\/[^/]+$/, { timeout: 10_000 });
  });
});
