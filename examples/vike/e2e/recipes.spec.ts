import { expect, test } from "@playwright/test";

test.describe("Recipes (HyperDown)", () => {
  test("lists recipes and opens a detail page", async ({ page }) => {
    await page.goto("/cooking");

    await expect(page.getByRole("heading", { level: 1, name: /recipes|cooking/i })).toBeVisible();

    const firstCard = page.locator('a[href*="/cooking/"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    await expect(page.getByTestId("page-title")).toBeVisible();
    await expect(page.getByRole("link", { name: /back to recipes/i })).toBeVisible();
  });
});
