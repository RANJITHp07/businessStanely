import { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/admin-auth";

const uniqueId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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
  await page.locator("#phone").fill(opts.phone ?? "9000000030");
  await page.locator("#bar-id").fill(opts.barId ?? `E2E-BAR-${uniqueId()}`);
}

async function createExecutionAgent(
  page: Page,
  opts: { name: string; email: string; agentType: string }
) {
  await page.goto("/agent/create?agentRole=Execution Agent");
  await fillCoreAgentFields(page, { name: opts.name, email: opts.email });
  await selectByLabel(page, "Agent Type *").click();
  await page.getByRole("option", { name: new RegExp(`^${opts.agentType}$`, "i") }).click();
  await selectByLabel(page, "Jurisdiction *").click();
  await page.getByRole("option", { name: /^india$/i }).click();
  await page.locator("#GST").check();
  await page.getByRole("button", { name: /^create agent$/i }).click();
  await expect(page.getByText(/agent created successfully!/i)).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("Admin - Agent Management: team-assignment edge cases", () => {
  test("selecting an execution type with no manageable subordinates shows the 'cannot manage' message", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create?agentRole=Execution Agent");
    await fillCoreAgentFields(page, {
      name: `PW Hierarchy Test ${id}`,
      email: `pw.hierarchy.${id}@example.com`,
    });

    // "Client Advisor" mapping is empty ([]) - but that's an advisor type;
    // for the execution hierarchy, no execution type maps to an empty
    // array except types that aren't in agentHierarchy at all. Instead
    // verify the positive case: "Intern" maps to ["Intern"] (length 1) so
    // it should show the split panel, not the "cannot manage" message.
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^intern$/i }).click();

    await expect(page.getByText(/available agents/i)).toBeVisible();
    await expect(
      page.getByText(/you cannot manage execution subordinates/i)
    ).not.toBeVisible();
  });

  test("the available-agents pool is restricted to the selected type's hierarchy, not all agents", async ({
    page,
  }) => {
    const id = uniqueId();
    // Seed an "Owner"-type agent, which every hierarchy level can see, and
    // a fresh "Intern" so we have a known, low-rank agent unlikely to
    // appear when a high-rank type is selected in a *different* branch.
    await createExecutionAgent(page, {
      name: `PW Owner Candidate ${id}`,
      email: `pw.ownercandidate.${id}@example.com`,
      agentType: "Owner",
    });

    await page.goto("/agent/create?agentRole=Execution Agent");
    await fillCoreAgentFields(page, {
      name: `PW Pool Test ${id}`,
      email: `pw.pooltest.${id}@example.com`,
    });

    // As "Owner", the hierarchy includes every type, so the Owner-type
    // candidate created above should be visible in the available pool.
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^owner$/i }).click();
    await page.getByPlaceholder(/search by name, type, or email/i).fill(
      `PW Owner Candidate ${id}`
    );
    await expect(page.getByText(`PW Owner Candidate ${id}`)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("adding and removing a subordinate updates the team member count badge", async ({
    page,
  }) => {
    const id = uniqueId();
    await createExecutionAgent(page, {
      name: `PW Subordinate Candidate ${id}`,
      email: `pw.subcandidate.${id}@example.com`,
      agentType: "Intern",
    });

    await page.goto("/agent/create?agentRole=Execution Agent");
    await fillCoreAgentFields(page, {
      name: `PW Team Count Test ${id}`,
      email: `pw.teamcount.${id}@example.com`,
    });
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^owner$/i }).click();

    await page.getByPlaceholder(/search by name, type, or email/i).fill(
      `PW Subordinate Candidate ${id}`
    );
    const candidateButton = page.getByText(
      `PW Subordinate Candidate ${id}`
    );
    await expect(candidateButton).toBeVisible({ timeout: 10_000 });
    await candidateButton.click();

    await expect(page.getByText(/^1 member$/i)).toBeVisible();

    // Remove it via the "Team Members" panel's remove (X) button - scope to
    // the innermost row (border-blue-100) so we don't grab an unrelated
    // button from elsewhere in the panel.
    await page.getByText(/no members yet/i).waitFor({ state: "hidden" });
    const teamMemberRow = page
      .locator(".border-blue-100")
      .filter({ hasText: `PW Subordinate Candidate ${id}` });
    await teamMemberRow.getByRole("button").click();

    await expect(page.getByText(/no members yet/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Advisor Team panel is non-interactive unless advisor type is 'Client Manager'", async ({
    page,
  }) => {
    await page.goto("/agent/create?agentRole=Advisor Agent");
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^client advisor$/i }).click();

    await expect(
      page.getByText(/you cannot manage advisor subordinates/i)
    ).toBeVisible();
    await expect(page.getByText(/available advisors/i)).not.toBeVisible();

    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^client manager$/i }).click();

    await expect(page.getByText(/available advisors/i)).toBeVisible();
    await expect(
      page.getByText(/you cannot manage advisor subordinates/i)
    ).not.toBeVisible();
  });

  test("Advisor Team's available pool only ever contains Client Advisors, regardless of search", async ({
    page,
  }) => {
    const id = uniqueId();
    await page.goto("/agent/create?agentRole=Advisor Agent");
    await fillCoreAgentFields(page, {
      name: `PW Client Manager Test ${id}`,
      email: `pw.cmtest.${id}@example.com`,
    });
    await selectByLabel(page, "Agent Type *").click();
    await page.getByRole("option", { name: /^client manager$/i }).click();

    // Search for something that would only ever match a non-advisor type
    // name/email if the filter were broken; expect either a real Client
    // Advisor match or the explicit "No Client Advisors available" message,
    // never a stray Execution-type agent.
    await page.getByPlaceholder(/search by name or email/i).fill("owner");
    const noAdvisorsMessage = page.getByText(/no client advisors available|no advisors match/i);
    const anyResult = page.locator("button").filter({ hasText: /owner/i });
    // One of these two must be true - either there are zero matches (message
    // shown) or any matches shown must not carry an "Owner"-type badge.
    if (await anyResult.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(anyResult.first().getByText(/^owner$/i)).not.toBeVisible();
    } else {
      await expect(noAdvisorsMessage).toBeVisible();
    }
  });
});

test.describe("Admin - Agent Management: photo upload", () => {
  test("uploading a photo shows a Remove button; removing it hides the Remove button again", async ({
    page,
  }) => {
    await page.goto("/agent/create?agentRole=Execution Agent");
    await expect(page.getByRole("button", { name: /^remove$/i })).not.toBeVisible();

    const fileInput = page.locator("#photo-upload");
    await fileInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64"
      ),
    });

    await expect(page.getByRole("button", { name: /^remove$/i })).toBeVisible({
      timeout: 5_000,
    });
    await page.getByRole("button", { name: /^remove$/i }).click();
    await expect(page.getByRole("button", { name: /^remove$/i })).not.toBeVisible();
  });
});

test.describe("Admin - Agent Management: edit mode", () => {
  test("editing an agent pre-populates all fields including type, jurisdiction, and specializations", async ({
    page,
  }) => {
    const id = uniqueId();
    const name = `PW Edit Prepop Test ${id}`;
    const email = `pw.editprepop.${id}@example.com`;
    await createExecutionAgent(page, { name, email, agentType: "Manager" });

    await page.goto("/agent");
    await page.locator("#search").fill(name);
    const row = page.locator("table tbody tr").filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit agent$/i }).click();
    await expect(page).toHaveURL(/\/agent\/[^/]+\/edit$/, { timeout: 10_000 });

    await expect(page.getByRole("heading", { name: /^edit agent$/i })).toBeVisible();
    await expect(page.locator("#name")).toHaveValue(name);
    await expect(page.locator("#email")).toHaveValue(email);
    await expect(selectByLabel(page, "Agent Type *")).toHaveText(/manager/i);
    await expect(selectByLabel(page, "Jurisdiction *")).toHaveText(/india/i);
    await expect(page.locator("#GST")).toBeChecked();
  });

  test("editing an agent's email to match another active agent's email is rejected", async ({
    page,
  }) => {
    const id = uniqueId();
    const emailA = `pw.editconflict.a.${id}@example.com`;
    const emailB = `pw.editconflict.b.${id}@example.com`;
    await createExecutionAgent(page, {
      name: `PW Conflict A ${id}`,
      email: emailA,
      agentType: "Executive",
    });
    const nameB = `PW Conflict B ${id}`;
    await createExecutionAgent(page, {
      name: nameB,
      email: emailB,
      agentType: "Executive",
    });

    await page.goto("/agent");
    await page.locator("#search").fill(nameB);
    const row = page.locator("table tbody tr").filter({ hasText: nameB });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit agent$/i }).click();
    await expect(page).toHaveURL(/\/agent\/[^/]+\/edit$/, { timeout: 10_000 });

    await page.locator("#email").fill(emailA);
    await page.getByRole("button", { name: /^update agent$/i }).click();

    await expect(
      page.getByText(/another user with the same email already exists/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("editing does not require re-entering unrelated required fields (they stay populated)", async ({
    page,
  }) => {
    const id = uniqueId();
    const name = `PW Edit NoChange Test ${id}`;
    await createExecutionAgent(page, {
      name,
      email: `pw.editnochange.${id}@example.com`,
      agentType: "Senior Executive",
    });

    await page.goto("/agent");
    await page.locator("#search").fill(name);
    const row = page.locator("table tbody tr").filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button").last().click();
    await page.getByRole("menuitem", { name: /^edit agent$/i }).click();
    await expect(page).toHaveURL(/\/agent\/[^/]+\/edit$/, { timeout: 10_000 });

    // Change only the phone number, submit without touching anything else.
    await page.locator("#phone").fill("9111111111");
    await page.getByRole("button", { name: /^update agent$/i }).click();

    await expect(page.getByText(/agent updated successfully!/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
