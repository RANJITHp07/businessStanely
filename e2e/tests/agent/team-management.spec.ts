import { test, expect } from "../../fixtures/agent-auth";

// Team Management on the agent side is entirely read-only: no create/edit/
// delete affordances anywhere (confirmed via source read of team/page.tsx
// and team/_component/teamTable.tsx and team/[id]/page.tsx). The list is
// driven by AgentSuperior links (/api/team-members?depth=direct), so the
// seeded e2e.agent@playwright.test account may legitimately have zero
// subordinates - tests handle both the populated and empty cases.
test.describe("Agent - Team Management: list", () => {
  test("team page shows heading, search, and filter controls", async ({
    page,
  }) => {
    await page.goto("/team");
    await expect(
      page.getByRole("heading", { name: /team members/i })
    ).toBeVisible();
    await expect(page.locator("#search")).toBeVisible();
  });

  test("search with no matches shows the empty state", async ({ page }) => {
    await page.goto("/team");
    await page.locator("#search").fill("zzz-no-such-team-member-zzz");
    await expect(
      page.getByText(/no teams found matching your criteria/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Agent Type and Jurisdiction filters are available and resettable", async ({
    page,
  }) => {
    await page.goto("/team");

    const agentTypeSelect = page
      .getByText("Agent Type", { exact: true })
      .first()
      .locator("..")
      .getByRole("combobox");
    await agentTypeSelect.click();
    await page.getByRole("option", { name: /^manager$/i }).click();

    const jurisdictionSelect = page
      .getByText("Jurisdiction", { exact: true })
      .first()
      .locator("..")
      .getByRole("combobox");
    await jurisdictionSelect.click();
    await page.getByRole("option", { name: /^india$/i }).click();

    await page.getByRole("button", { name: /^clear$/i }).click();
    await expect(agentTypeSelect).toHaveText(/all types/i);
    await expect(jurisdictionSelect).toHaveText(/all jurisdictions/i);
  });

  test("there is no 'Create'/'Add Team Member' action anywhere on this page", async ({
    page,
  }) => {
    await page.goto("/team");
    await expect(
      page.getByRole("button", { name: /create|add team member|invite/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /create|add team member|invite/i })
    ).toHaveCount(0);
  });

  test("row action menu only offers 'View Details', no edit/delete", async ({
    page,
  }) => {
    await page.goto("/team");
    const firstRow = page.locator("table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(
        true,
        "Seeded test agent has no team members (no AgentSuperior links) in this environment"
      );
    }

    await firstRow.getByRole("button").last().click();
    await expect(
      page.getByRole("menuitem", { name: /view details/i })
    ).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^edit/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /delete/i })).toHaveCount(0);
  });
});

test.describe("Agent - Team Management: detail", () => {
  test("opening a team member shows a read-only detail view with tabs, no edit form", async ({
    page,
  }) => {
    await page.goto("/team");
    const firstRow = page.locator("table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(
        true,
        "Seeded test agent has no team members (no AgentSuperior links) in this environment"
      );
    }

    await firstRow.click();
    await expect(page).toHaveURL(/\/team\/[^/]+\?tab=/, { timeout: 10_000 });

    // No editable form fields (inputs) should be present on a pure detail view.
    await expect(page.locator("input")).toHaveCount(0);
  });

  test("navigating directly to a non-existent team member id does not crash", async ({
    page,
  }) => {
    const response = await page.goto("/team/000000000000000000000000");
    expect(response?.status()).toBeLessThan(500);
  });
});
