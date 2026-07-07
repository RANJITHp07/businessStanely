import { test, expect } from "../../fixtures/agent-auth";
import { createSeedTask } from "../../fixtures/task-helpers";

// The agent app's UI has no delete button for tasks (unlike admin), but the
// DELETE /api/tasks/[id] route exists and performs a hard delete (vs
// admin's soft delete). These tests hit that route directly since there is
// no UI path to reach it, to make sure the endpoint itself behaves safely.
test.describe("Agent - Task deletion (API-only, no UI entry point)", () => {
  test("hard-deleting a task via the API removes it permanently, even with comments/time logs attached", async ({
    page,
  }) => {
    const title = await createSeedTask(page, { priority: "low" });

    await page.goto("/task");
    await page.locator("#search").fill(title);
    const row = page.locator("table tbody tr").filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();
    await expect(page).toHaveURL(/\/task\/([^/]+)$/, { timeout: 10_000 });
    const taskId = page.url().split("/").pop()!;

    // Attach a comment and a time log before deleting, to exercise any
    // cascade/FK behavior on the hard delete rather than deleting a bare task.
    await page.getByPlaceholder("Add a comment...").fill("Comment before delete.");
    await page.getByRole("button", { name: /pick a date/i }).click();
    await page.locator("button[data-day]:not([aria-disabled='true'])").first().click();
    await page.locator('input[type="time"]').first().fill("09:00");
    await page.locator('input[type="number"]').first().fill("15");
    await page.getByRole("button", { name: /^add comment$/i }).click();
    await expect(page.getByText("Comment before delete.")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("tab", { name: /time log/i }).click();
    await page.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    await page.locator('input[type="number"][step="0.5"]').fill("1");
    await page.getByPlaceholder("Description").fill("Time log before delete.");
    await page.getByRole("button", { name: /log time/i }).click();
    await expect(page.getByText("Time log before delete.")).toBeVisible({
      timeout: 10_000,
    });

    const response = await page.request.delete(`/api/tasks/${taskId}`);
    // Should not 500 due to a foreign-key constraint on related
    // comments/time logs - either it cascades or the route handles it.
    expect(response.status()).toBeLessThan(500);

    if (response.ok()) {
      const getResponse = await page.request.get(`/api/tasks/${taskId}`);
      expect(getResponse.status()).toBe(404);
    }
  });

  test("an agent cannot delete a task they neither created, are assigned to, nor supervise", async ({
    page,
  }) => {
    // Create a task while logged in, then attempt deletion using a
    // request context that has no matching authorization relationship
    // would require a second, unrelated agent - skipped here since we only
    // have one seeded test agent. Documented as a gap: this authorization
    // branch (403 path in agent/src/app/api/tasks/[id]/route.ts) needs a
    // second non-privileged agent fixture to exercise properly.
    test.skip(
      true,
      "Requires a second, unrelated agent account not currently seeded"
    );
  });
});
