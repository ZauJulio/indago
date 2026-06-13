import { expect, test } from "@playwright/test";

// Standardized across every @indago/create-app template. The home page links to
// the three content sections, and every listing links back home. Locale-aware
// `<Link to="/…">` renders prefix-free hrefs in the default locale, so the same
// selectors hold in each framework.

test.describe("Navigation", () => {
  test("home links to each content section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const sections = [
      { href: "/articles", heading: /articles/i },
      { href: "/cooking", heading: /recipes/i },
      { href: "/projects", heading: /projects/i },
    ] as const;

    for (const { href, heading } of sections) {
      await page.goto("/");
      await page.locator(`a[href="${href}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${href}/?$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("a listing links back to the home page", async ({ page }) => {
    await page.goto("/articles");
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
