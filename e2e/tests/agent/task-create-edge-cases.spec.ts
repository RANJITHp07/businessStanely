import { test, expect } from "../../fixtures/agent-auth";

const runId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

async function fillBaseTaskFields(page: import("@playwright/test").Page, id: string) {
  await page.locator("#task-name").fill(`PW Agent Edge Task ${id}`);
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
  await page.locator("#lastName").fill(`AgentEdge${id}`);
  await page.locator('[id="email"]').first().fill(`pw.agentedge.${id}@example.com`);
  await page.locator('[id="phoneNumber"]').first().fill("9000000004");
  await page.getByRole("button", { name: /^create client$/i }).click();
}

async function createOrganizationClientInline(
  page: import("@playwright/test").Page,
  id: string
) {
  await page.getByRole("button", { name: /add client/i }).click();
  await page.locator("#client-type").click();
  await page.getByRole("option", { name: /organization/i }).click();
  await page.locator("#organizationName").fill(`PW Agent Org ${id}`);
  await page.locator("#authorizedPersonName").fill("Playwright Signatory");
  await page.locator('[id="email"]').first().fill(`pw.agentorg.${id}@example.com`);
  await page.locator('[id="phoneNumber"]').first().fill("9000000005");
  await page.getByRole("button", { name: /^create client$/i }).click();
}

test.describe("Agent - Task creation edge cases", () => {
  test("plain create: new task appears in the task list afterward", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Agent Category ${id}`);
    await createIndividualClientInline(page, id);
    await expect(page.locator("#client")).toHaveValue(/Playwright/, {
      timeout: 10_000,
    });

    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^medium$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.getByRole("button", { name: /create task/i }).click();

    await page.goto("/task");
    await page.locator("#search").fill(`PW Agent Edge Task ${id}`);
    await expect(page.getByText(`PW Agent Edge Task ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("organization-type client: switching client type swaps required fields", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Agent Category Org ${id}`);
    await createOrganizationClientInline(page, id);

    await expect(page.locator("#client")).toHaveValue(/PW Agent Org/, {
      timeout: 10_000,
    });
    await expect(page.locator("#contact-number")).toHaveValue("9000000005");
    await expect(page.locator("#email-id")).toHaveValue(
      `pw.agentorg.${id}@example.com`
    );

    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^low$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.getByRole("button", { name: /create task/i }).click();
    await page.goto("/task");
    await page.locator("#search").fill(`PW Agent Edge Task ${id}`);
    await expect(page.getByText(`PW Agent Edge Task ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("newly-created pending category is usable immediately in the same task", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);

    const categoryName = `PW Agent Pending Category ${id}`;
    await createCategoryInline(page, categoryName);
    await expect(page.locator("#taskCategory")).toHaveValue(categoryName);

    await createIndividualClientInline(page, id);
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^high$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.getByRole("button", { name: /create task/i }).click();
    await page.goto("/task");
    await page.locator("#search").fill(`PW Agent Edge Task ${id}`);
    await expect(page.getByText(`PW Agent Edge Task ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("recurring task requires a trigger date before it can be submitted", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Agent Recurring Category ${id}`);
    await createIndividualClientInline(page, id);
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^medium$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.locator("#recurring").click();
    await page.getByRole("option", { name: /every 1 week/i }).click();
    await expect(page.getByText(/trigger date/i)).toBeVisible();

    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page).toHaveURL(/\/task\/create/);
  });

  test("'trigger only once' checkbox creates an inactive task hidden from the default list", async ({
    page,
  }) => {
    const id = runId();
    await page.goto("/task/create");
    await fillBaseTaskFields(page, id);
    await createCategoryInline(page, `PW Agent Trigger Category ${id}`);
    await createIndividualClientInline(page, id);
    await page.locator("#priority").click();
    await page.getByRole("option", { name: /^low$/i }).click();
    await pickFirstSuggestion(page, "assigned-agent");

    await page.locator("#recurring").click();
    await page.getByRole("option", { name: /trigger only once/i }).click();

    await page
      .getByRole("button", { name: /select trigger date/i })
      .click();
    await page
      .locator("button[data-day]:not([aria-disabled='true'])")
      .first()
      .click();

    await page.getByRole("checkbox").first().check();
    await expect(
      page.getByText(/task will be created only on the trigger date/i)
    ).toBeVisible();

    await page.getByRole("button", { name: /create task/i }).click();

    await page.goto("/task");
    await page.locator("#search").fill(`PW Agent Edge Task ${id}`);
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
    await createCategoryInline(page, `PW Agent Required Category ${id}`);

    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page).toHaveURL(/\/task\/create/);
  });

  test("task created from a Task Category's 'Add Task' link pre-fills that category", async ({
    page,
  }) => {
    await page.goto("/task_category/create");
    const categoryName = `PW Agent Linked Category ${runId()}`;
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
    await page.goto("/retainership");
    const firstRetainershipRow = page.locator("table tbody tr").first();
    if (!(await firstRetainershipRow.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "No existing retainership record in this environment");
    }
    await firstRetainershipRow.click();
    await expect(page).toHaveURL(/\/retainership\/[^/]+$/, { timeout: 10_000 });

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
    await expect(page.locator("#client")).toBeDisabled();
    await expect(page.locator("#assigned-agent")).toBeDisabled();
  });
});
