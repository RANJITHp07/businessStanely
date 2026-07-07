import { Page, expect } from "@playwright/test";

export const uniqueId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export async function pickFirstSuggestion(
  page: Page,
  inputId: string,
  query = "a"
) {
  await page.locator(`#${inputId}`).fill(query);
  const suggestion = page
    .locator(`#${inputId}`)
    .locator("xpath=following::div[contains(@class,'cursor-pointer')]")
    .first();
  await expect(suggestion).toBeVisible({ timeout: 10_000 });
  await suggestion.click();
}

export async function createCategoryInline(page: Page, name: string) {
  await page.getByRole("button", { name: /^add$/i }).first().click();
  await page.locator("#category-name").fill(name);
  await page.getByRole("button", { name: /create/i }).last().click();
  await expect(page.locator("#taskCategory")).toHaveValue(name, {
    timeout: 10_000,
  });
}

export async function createIndividualClientInline(page: Page, id: string) {
  await page.getByRole("button", { name: /add client/i }).click();
  await page.locator("#client-type").click();
  await page.getByRole("option", { name: /individual/i }).click();
  await page.locator("#firstName").fill("Playwright");
  await page.locator("#lastName").fill(`Seed${id}`);
  await page.locator('[id="email"]').first().fill(`pw.seed.${id}@example.com`);
  await page.locator('[id="phoneNumber"]').first().fill("9000000010");
  await page.getByRole("button", { name: /^create client$/i }).click();
}

/**
 * Creates a plain task via /task/create and returns its title, so callers
 * can search for it and open its detail page. Requires the caller's page to
 * already be authenticated (use inside a test with the admin/agent fixture).
 */
export async function createSeedTask(
  page: Page,
  opts?: { priority?: "low" | "medium" | "high"; titlePrefix?: string }
): Promise<string> {
  const id = uniqueId();
  const title = `${opts?.titlePrefix ?? "PW Seed Task"} ${id}`;

  await page.goto("/task/create");
  await page.locator("#task-name").fill(title);
  await page
    .locator("#description")
    .fill("Seed task created by Playwright - safe to delete.");
  await createCategoryInline(page, `PW Seed Category ${id}`);
  await createIndividualClientInline(page, id);

  await page.locator("#priority").click();
  await page
    .getByRole("option", { name: new RegExp(`^${opts?.priority ?? "medium"}$`, "i") })
    .click();
  await pickFirstSuggestion(page, "assigned-agent");

  await page.getByRole("button", { name: /create task/i }).click();

  return title;
}

/** Navigates to /task, searches for the given title, and opens its detail page. */
export async function openTaskByTitle(page: Page, title: string) {
  await page.goto("/task");
  await page.locator("#search").fill(title);
  const row = page.getByText(title).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  await expect(page).toHaveURL(/\/task\/[^/]+$/, { timeout: 10_000 });
}
