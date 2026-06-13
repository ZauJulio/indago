import { expect, test } from "@playwright/test";

// Standardized across every @indago/create-app template. The DOM contract these
// specs assert (h1 text, card hrefs, back-link names) must be identical in each
// framework's components.

test.describe("Articles (HyperDown)", () => {
  test("lists articles and opens a detail page", async ({ page }) => {
    await page.goto("/articles");

    await expect(page.getByRole("heading", { level: 1, name: /articles/i })).toBeVisible();

    const firstCard = page.locator('a[href*="/articles/"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Detail pages render two h1s (page title + MDX body heading); assert the
    // page's own title deterministically via its test id.
    await expect(page.getByTestId("page-title")).toBeVisible();
    await expect(page.getByRole("link", { name: /back to articles/i })).toBeVisible();
  });

  test("serves a listing for a search-query URL", async ({ page }) => {
    await page.goto("/articles?q=hyper");
    await expect(page.locator('a[href*="/articles/"]').first()).toBeVisible();
  });
});
