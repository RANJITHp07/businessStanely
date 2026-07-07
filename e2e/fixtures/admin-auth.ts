import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "ADMIN_EMAIL / ADMIN_PASSWORD must be set (see e2e/.env.example)"
      );
    }

    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Handle single-session lock by forcing login if another session is active.
    const forceButton = page.getByRole("button", { name: /force login/i });
    if (await forceButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceButton.click();
    }

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await use(page);
  },
});

export { expect };
