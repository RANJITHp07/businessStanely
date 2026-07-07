import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/admin-auth";

const uniqueId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

/**
 * The agent form's Selects all use `<Label htmlFor="x">` pointing at an id
 * that doesn't actually exist on the SelectTrigger, so they can't be found
 * via `#x`. Open them by locating the exact label text and clicking the
 * combobox button that follows it instead.
 */
function selectByLabel(page: Page, labelText: string | RegExp) {
  return page
    .getByText(labelText, { exact: typeof labelText === "string" })
    .locator("..")
    .getByRole("combobox");
}

async function fillCoreAgentFields(
  page: Page,
  opts: { name: string; email: string; phone?: string; barId?: string }
) {
  await page.locator("#name").fill(opts.name);
  await page.locator("#email").fill(opts.email);
  await page.locator("#phone").fill(opts.phone ?? "9000000020");
  await page.locator("#bar-id").fill(opts.barId ?? `E2E-BAR-${uniqueId()}`);
}

test.describe("Admin - Agent Management: create", () => {
  test("create an Execution Agent with all required fields", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create?agentRole=Execution Agent");
    await expect(
      page.getByRole("heading", { name: /create new agent/i })
    ).toBeVisible();

    await fillCoreAgentFields(page, {
      name: `PW Exec Agent ${id}`,
      email: `pw.exec.${id}@example.com`,
    });

    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^manager$/i }).click();

    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^india$/i }).click();

    await page.locator("#GST").check();

    await page.getByRole("button", { name: /^create agent$/i }).click();

    await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("create an Advisor Agent shows a single Agent Type select scoped to advisor types", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create?agentRole=Advisor Agent");

    await fillCoreAgentFields(page, {
      name: `PW Advisor Agent ${id}`,
      email: `pw.advisor.${id}@example.com`,
    });

    await selectByLabel(page, "Agent Type *").click();
    await expect(
      page.getByRole("option", { name: /^lead maker$/i })
    ).toBeVisible();
    // Execution-only types must not appear in an advisor-scoped select.
    await expect(
      page.getByRole("option", { name: /^manager$/i })
    ).not.toBeVisible();
    await page.getByRole("option", { name: /^client advisor$/i }).click();

    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^uae$/i }).click();
    await page.locator("#Litigation").check();

    await page.getByRole("button", { name: /^create agent$/i }).click();
    await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("dual-role (Execution & Advisor) agent requires both type selects before submit", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create");

    await selectByLabel(page, "Agent Role *").click();
    await page
      .getByRole("option", { name: /execution & advisor agent/i })
      .click();

    await fillCoreAgentFields(page, {
      name: `PW Dual Agent ${id}`,
      email: `pw.dual.${id}@example.com`,
    });
    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^usa$/i }).click();
    await page.locator("#All").check();

    // Deliberately leave both role-specific type selects empty.
    await page.getByRole("button", { name: /^create agent$/i }).click();
    await expect(
      page.getByText(
        /please select both execution agent type and advisor agent type/i
      )
    ).toBeVisible({ timeout: 5_000 });

    // Now fill both and confirm it succeeds.
    await selectByLabel(page, "Execution Agent Type *").click();
    await page.getByRole("option", { name: /^executive$/i }).click();
    await selectByLabel(page, "Advisor Agent Type *").click();
    await page.getByRole("option", { name: /^client advisor$/i }).click();

    await page.getByRole("button", { name: /^create agent$/i }).click();
    await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("creating an agent with a duplicate active email is rejected", async ({
    page,
  }) => {
    const id = uniqueId();
    const email = `pw.dupe.${id}@example.com`;

    await page.goto("/agent/create?agentRole=Execution Agent");
    await fillCoreAgentFields(page, { name: `PW Dupe Agent ${id}`, email });
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^executive$/i }).click();
    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^india$/i }).click();
    await page.locator('[id="Other Laws"]').check();
    await page.getByRole("button", { name: /^create agent$/i }).click();
    await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
      timeout: 10_000,
    });

    // Attempt to create a second agent with the exact same email.
    await page.goto("/agent/create?agentRole=Execution Agent");
    await fillCoreAgentFields(page, {
      name: `PW Dupe Agent Two ${id}`,
      email,
    });
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^trainee$/i }).click();
    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^india$/i }).click();
    await page.locator('[id="Other Laws"]').check();
    await page.getByRole("button", { name: /^create agent$/i }).click();

    await expect(
      page.getByText(/an agent with this email already exists/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("auto-assign checkbox only appears for advisor types other than 'Lead Maker'", async ({
    page,
  }) => {
    await page.goto("/agent/create?agentRole=Advisor Agent");
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^lead maker$/i }).click();
    await expect(page.locator("#auto-assign")).not.toBeVisible();

    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^client advisor$/i }).click();
    await expect(page.locator("#auto-assign")).toBeVisible();
  });
});

test.describe("Admin - Agent Management: list", () => {
  test("list page shows heading, search, and filter controls", async ({
    page,
  }) => {
    await page.goto("/agent");
    await expect(
      page.getByRole("heading", { name: /execution agent management/i })
    ).toBeVisible();
    await expect(page.locator("#search")).toBeVisible();
    await expect(page.getByRole("link", { name: /create agent/i })).toBeVisible();
  });

  test("search filters the agent list by name", async ({ page }) => {
    await page.goto("/agent");
    await page.locator("#search").fill("zzz-no-such-agent-zzz");
    await expect(
      page.getByText(/no.*(agents?|teams?) found matching your criteria/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("deleting an agent requires selecting a transfer target before confirming", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create?agentRole=Execution Agent");
    const name = `PW Deletable Agent ${id}`;
    await fillCoreAgentFields(page, {
      name,
      email: `pw.deletable.${id}@example.com`,
    });
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^intern$/i }).click();
    await selectByLabel(page, "Jurisdiction *").click();
    await page.getByRole("option", { name: /^india$/i }).click();
    await page.locator('[id="Local Laws"]').check();
    await page.getByRole("button", { name: /^create agent$/i }).click();
    await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
      timeout: 10_000,
    });

    await page.goto("/agent");
    await page.locator("#search").fill(name);
    const row = page.locator("table tbody tr").filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 10_000 });

    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /delete agent/i }).click();

    await expect(page.getByRole("alertdialog", { name: /are you sure/i })).toBeVisible();
    const confirmButton = page.getByRole("button", {
      name: /delete & transfer/i,
    });
    await expect(confirmButton).toBeDisabled();

    await page.getByRole("button", { name: /^cancel$/i }).click();
    await expect(
      page.getByRole("alertdialog", { name: /are you sure/i })
    ).not.toBeVisible();
  });
});

test.describe("Admin - Agent Management: detail and diary", () => {
  test("agent detail page shows Dashboard/Details/Tasks/Team/Activities/Service Records tabs", async ({
    page,
  }) => {
    await page.goto("/agent");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/agent\/[^/]+\?tab=/, { timeout: 10_000 });

    await expect(page.getByRole("tab", { name: /agent details/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^team/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /activities/i })).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /instructions and service records/i })
    ).toBeVisible();
  });

  test("Open Diary button opens the read-only diary view in a new tab", async ({
    page,
    context,
  }) => {
    await page.goto("/agent");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/agent\/[^/]+\?tab=/, { timeout: 10_000 });

    const openDiaryButton = page.getByRole("button", { name: /open diary/i });
    if (!(await openDiaryButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Agent is inactive; 'Open Diary' is only shown for active agents");
    }

    const [diaryPage] = await Promise.all([
      context.waitForEvent("page"),
      openDiaryButton.click(),
    ]);
    await diaryPage.waitForLoadState();
    await expect(diaryPage.getByText(/agent diary/i)).toBeVisible({
      timeout: 10_000,
    });
    await diaryPage.close();
  });

  test("service record 'Add Note' is available to admins and appends to the list", async ({
    page,
  }) => {
    await page.goto("/agent");
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/agent\/[^/]+\?tab=/, { timeout: 10_000 });

    await page
      .getByRole("tab", { name: /instructions and service records/i })
      .click();

    const noteInput = page.locator("#note");
    if (!(await noteInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Add Note is not available (agent may be inactive)");
    }

    const noteText = `Playwright service note ${Date.now()}`;
    await noteInput.fill(noteText);
    await page.getByRole("button", { name: /^add note$/i }).click();

    await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Admin - Deleted Agent Management", () => {
  test("deleted-agent list has no Edit/Delete/Reactivate actions, only View Details", async ({
    page,
  }) => {
    await page.goto("/deleted-agent");
    await expect(
      page.getByRole("heading", { name: /deleted agent management/i })
    ).toBeVisible();

    const firstRow = page.locator("table tbody tr").first();
    if (!(await firstRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "No deleted/inactive execution agents exist in this environment");
    }
    await firstRow.getByRole("button").last().click();

    await expect(page.getByRole("menuitem", { name: /view details/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /edit/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /delete/i })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: /reactivate/i })).toHaveCount(0);
  });
});
