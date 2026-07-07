import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const email = process.env.AGENT_EMAIL;
    const password = process.env.AGENT_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "AGENT_EMAIL / AGENT_PASSWORD must be set (see e2e/.env.example)"
      );
    }

    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    const forceButton = page.getByRole("button", { name: /force login/i });
    if (await forceButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceButton.click();
    }

    await expect(page).toHaveURL(/\/(dashboard|sales\/dashboard)/, {
      timeout: 15_000,
    });
    await use(page);
  },
});

export { expect };
