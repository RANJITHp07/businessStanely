import { test, expect } from "../../fixtures/admin-auth";

// Each test creates its own uniquely-named data so runs don't collide and
// results are easy to identify/clean up afterward.
const runId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

async function fillBaseTaskFields(page: import("@playwright/test").Page, id: string) {
  await page.locator("#task-name").fill(`PW Edge Task ${id}`);
  await page
    .locator("#description")
    .fill("Playwright edge-case test - safe to delete.");
}

async function pickFirstSuggestion(
  page: import("@playwright/test").Page,
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

async function createCategoryInline(
  page: import("@playwright/test").Page,
  name: string
) {
  await page.getByRole("button", { name: /^add$/i }).first().click();
  await page.locator("#category-name").fill(name);
  await page.getByRole("button", { name: /create/i }).last().click();
  await expect(page.locator("#taskCategory")).toHaveValue(name, {
    timeout: 10_000,
  });
}

async function createIndividualClientInline(
  page: import("@playwright/test").Page,
  id: string
) {
  await page.getByRole("button", { name: /add client/i }).click();
  await page.locator("#client-type").click();
  await page.getByRole("option", { name: /individual/i }).click();
  await page.locator("#firstName").fill("Playwright");
  await page.locator("#lastName").fill(`Edge${id}`);
  await page.locator('[id="email"]').first().fill(`pw.edge.${id}@example.com`);
  await page.locator('[id="phoneNumber"]').first().fill("9000000002");
  await page.getByRole("button", { name: /^create client$/i }).click();
}

async function createOrganizationClientInline(
  page: import("@playwright/test").Page,
  id: string
) {
  await page.getByRole("button", { name: /add client/i }).click();
  await page.locator("#client-type").click();
  await page.getByRole("option", { name: /organization/i }).click();
  await page.locator("#organizationName").fill(`PW Org ${id}`);
  await page.locator("#authorizedPersonName").fill("Playwright Signatory");
  await page.locator('[id="email"]').first().fill(`pw.org.${id}@example.com`);
  await page.locator('[id="phoneNumber"]').first().fill("9000000003");
  await page.getByRole("button", { name: /^create client$/i }).click();
}

test.describe("Admin - Task creation edge cases", () => {
  test("plain create: new task appears in the task list afterward", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Category ${id}`);
    await createIndividualClientInline(page, id);
    await expect(page.locator("#client")).toHaveValue(/Playwright/, {
      timeout: 10_000,
    });

    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^medium$/i }).click();

    await pickFirstSuggestion(page, "assigned-agent");

    await page.getByRole("button", { name: /create task/i }).click();

    // Correct behavior: land back on the task list and see the new task,
    // regardless of the tab/page the create form was launched from.
    await page.goto("/task");
    await page.locator("#search").fill(`PW Edge Task ${id}`);
    await expect(page.getByText(`PW Edge Task ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("organization-type client: switching client type swaps required fields", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Category Org ${id}`);
    await createOrganizationClientInline(page, id);

    await expect(page.locator("#client")).toHaveValue(/PW Org/, {
      timeout: 10_000,
    });
    // Auto-filled contact fields should reflect the organization's own values.
    await expect(page.locator("#contact-number")).toHaveValue("9000000003");
    await expect(page.locator("#email-id")).toHaveValue(
      `pw.org.${id}@example.com`
    );

    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^low$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.getByRole("button", { name: /create task/i }).click();
    await page.goto("/task");
    await page.locator("#search").fill(`PW Edge Task ${id}`);
    await expect(page.getByText(`PW Edge Task ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("newly-created pending category is usable immediately in the same task", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);

    const categoryName = `PW Pending Category ${id}`;
    await createCategoryInline(page, categoryName);
    // A pending (unapproved) category must still be selected and usable for
    // creating the task right away - approval only gates later visibility.
    await expect(page.locator("#taskCategory")).toHaveValue(categoryName);

    await createIndividualClientInline(page, id);
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^high$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.getByRole("button", { name: /create task/i }).click();
    await page.goto("/task");
    await page.locator("#search").fill(`PW Edge Task ${id}`);
    await expect(page.getByText(`PW Edge Task ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("recurring task requires a trigger date before it can be submitted", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Recurring Category ${id}`);
    await createIndividualClientInline(page, id);
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^medium$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.locator("#recurring").click();
    await page.getByRole("option", { name: /every 1 week/i }).click();

    // Trigger Date field should now be visible and required.
    await expect(page.getByText(/trigger date/i)).toBeVisible();

    // Submitting without a trigger date should be rejected (client or server
    // side) rather than silently creating a broken recurring task.
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page).toHaveURL(/\/task\/create/);
  });

  test("'trigger only once' checkbox creates an inactive task hidden from the default list", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Trigger Category ${id}`);
    await createIndividualClientInline(page, id);
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^low$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.locator("#recurring").click();
    await page.getByRole("option", { name: /trigger only once/i }).click();

    const triggerDateButton = page.getByRole("button", {
      name: /select trigger date/i,
    });
    await triggerDateButton.click();
    // Pick a future day from the calendar popover (skip aria-disabled days).
    await page
      .locator("button[data-day]:not([aria-disabled='true'])")
      .first()
      .click();

    await page.getByRole("checkbox").first().check();
    await expect(
      page.getByText(/task will be created only on the trigger date/i)
    ).toBeVisible();

    await page.getByRole("button", { name: /create task/i }).click();

    // Default list view filters active=true, so this task should NOT appear
    // there even though creation succeeded.
    await page.goto("/task");
    await page.locator("#search").fill(`PW Edge Task ${id}`);
    await expect(
      page.getByText(/no tasks found matching your criteria/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("cannot submit without selecting a client, agent, or priority", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Required Category ${id}`);

    // Deliberately skip client, priority, and agent selection.
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page).toHaveURL(/\/task\/create/);
  });

  test("task created from a Task Category's 'Add Task' link pre-fills that category", async ({
    page,
  }) => {
    // Create a category first via the category management page so we have a
    // real categoryId to deep-link with, matching the real "Add Task" flow.
    await page.goto("/task_category/create");
    const categoryName = `PW Linked Category ${runId()}`;
    await page.locator("#username").fill(categoryName);
    await page.getByRole("button", { name: /create service/i }).click();

    await page.goto("/task_category");
    await page.getByText(categoryName).first().click();
    await expect(page).toHaveURL(/\/task_category\/[^/]+$/, {
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /add task/i }).click();
    await expect(page).toHaveURL(/\/task\/create\?serviceId=/, {
      timeout: 10_000,
    });
    await expect(page.locator("#taskCategory")).toHaveValue(categoryName);
  });

  test("task created from a Retainership's legislation locks client and agent fields", async ({
    page,
  }) => {
    // This flow requires an existing, non-pending Retainership with at least
    // one Legislation row; skip gracefully if the environment has none
    // rather than failing on unrelated missing fixture data.
    await page.goto("/retainership");
    const firstRetainershipRow = page.locator("table tbody tr").first();
    if (!(await firstRetainershipRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "No existing retainership record in this environment");
    }
    await firstRetainershipRow.click();
    await expect(page).toHaveURL(/\/retainership\/[^/]+$/, { timeout: 10_000 });

    // "Create Task" lives inside each legislation row's actions dropdown.
    const rowMenuTrigger = page
      .locator("table tbody tr")
      .first()
      .getByRole("button")
      .last();
    if (!(await rowMenuTrigger.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Retainership has no linked legislation to add a task from");
    }
    await rowMenuTrigger.click();

    const createTaskLink = page.getByRole("menuitem", { name: /create task/i });
    if (!(await createTaskLink.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Create Task action not available (retainership likely still pending)");
    }
    await createTaskLink.click();

    await expect(page).toHaveURL(/\/task\/create\?legislationId=/, {
      timeout: 10_000,
    });
    // Client and Assign-Agent search inputs should be disabled/locked since
    // they're driven by the retainership's legislation.
    await expect(page.locator("#client")).toBeDisabled();
    await expect(page.locator("#assigned-agent")).toBeDisabled();
  });
});
