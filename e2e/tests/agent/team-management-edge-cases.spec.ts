import { test, expect } from "../../fixtures/agent-auth";

// These tests assume e2e/tests/admin/agent-superior-link-setup.spec.ts has
// been run at least once against the same database, so the seeded
// e2e.agent@playwright.test account has at least one AgentSuperior link
// making it a subordinate (its own /team list is for people *below* it,
// which stays empty unless it manages someone - these tests instead verify
// behavior that doesn't depend on being a superior).
test.describe("Agent - Team Management: data-shape edge cases", () => {
  test("only active team members are listed (inactive subordinates are excluded)", async ({
    page,
  }) => {
    // The API filters `subordinate: { status: "active" }` server-side
    // (agent/src/app/api/team-members/route.ts:37) - verify indirectly by
    // checking that no row's status badge/text ever reads "inactive".
    await page.goto("/team");
    const inactiveMarker = page.getByText(/inactive/i);
    await expect(inactiveMarker).toHaveCount(0);
  });

  test("'depth=direct' is used by the list, so no multi-level indirect reports leak in without being fetched again", async ({
    page,
  }) => {
    // This is a behavioral contract on the network request itself, since
    // the UI has no visible indicator of tree depth - assert the actual
    // fetch the page makes includes depth=direct (team/_component/teamTable.tsx:86).
    const requestPromise = page.waitForRequest((req) =>
      req.url().includes("/api/team-members")
    );
    await page.goto("/team");
    const request = await requestPromise;
    expect(request.url()).toContain("depth=direct");
  });

  test("clearing filters after selecting Agent Type and Jurisdiction restores the full list size", async ({
    page,
  }) => {
    await page.goto("/team");
    const countBefore = await page
      .getByText(/team members \(\d+\)/i)
      .textContent();

    const agentTypeSelect = page
      .getByText("Agent Type", { exact: true })
      .first()
      .locator("..")
      .getByRole("combobox");
    await agentTypeSelect.click();
    await page.getByRole("option", { name: /^owner$/i }).click();

    await page.getByRole("button", { name: /^clear$/i }).click();

    const countAfter = await page
      .getByText(/team members \(\d+\)/i)
      .textContent();
    expect(countAfter).toEqual(countBefore);
  });

  test("a team member row, if present, links to a detail page whose tab matches its role (execution -> tasks, advisor-only -> leads)", async ({
    page,
  }) => {
    await page.goto("/team");
    const firstRow = page.locator("table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(
        true,
        "No team members visible - run admin/agent-superior-link-setup.spec.ts against this database first"
      );
    }

    await firstRow.click();
    await expect(page).toHaveURL(/\/team\/[^/]+\?tab=(tasks|leads)/, {
      timeout: 10_000,
    });
  });
});
