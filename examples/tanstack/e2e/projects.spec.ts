import { expect, test } from "@playwright/test";

test.describe("Projects (HyperJson)", () => {
  test("lists schema-validated projects", async ({ page }) => {
    await page.goto("/projects");

    await expect(page.getByRole("heading", { level: 1, name: /projects/i })).toBeVisible();

    const cards = page.locator('[data-testid="project-card"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });
});
