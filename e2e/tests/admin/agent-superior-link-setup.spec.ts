import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/admin-auth";

const uniqueId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

function selectByLabel(page: Page, labelText: string | RegExp) {
  return page
    .getByText(labelText, { exact: typeof labelText === "string" })
    .locator("..")
    .getByRole("combobox");
}

// The agent-side Team Management view (e2e/tests/agent/team-management.spec.ts)
// is entirely read-only and can't create its own AgentSuperior links, so the
// seeded e2e.agent@playwright.test account (agentType: "Manager") starts
// with zero team members. This test uses the admin app - the only place
// subordinate assignment actually happens - to create a superior ("Owner"
// type, whose hierarchy includes "Manager") with the seeded agent attached
// as a subordinate, giving the agent-side tests real populated data to
// assert against.
test.describe("Admin - Agent Management: seed a superior link for the test agent", () => {
  test("assign the seeded e2e test agent as a subordinate of a new Owner-type agent", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create?agentRole=Execution Agent");
    await page.locator("#name").fill(`PW Superior Of Seed Agent ${id}`);
    await page
      .locator("#email")
      .fill(`pw.superiorofseed.${id}@example.com`);
    await page.locator("#phone").fill("9000000040");
    await page.locator("#bar-id").fill(`E2E-BAR-${id}`);

    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^owner$/i }).click();
    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^india$/i }).click();
    await page.locator("#GST").check();

    await page
      .getByPlaceholder(/search by name, type, or email/i)
      .fill("E2E Test Agent");
    const seedAgentButton = page.getByText("E2E Test Agent", { exact: true });
    await expect(seedAgentButton).toBeVisible({ timeout: 10_000 });
    await seedAgentButton.click();
    await expect(page.getByText(/^1 member$/i)).toBeVisible();

    await page.getByRole("button", { name: /^create agent$/i }).click();
    await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
