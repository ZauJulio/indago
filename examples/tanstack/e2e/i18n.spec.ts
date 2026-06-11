import { expect, test } from "@playwright/test";

// The default locale (en) is served prefix-free; pt-BR lives under /pt.
test.describe("i18n", () => {
  test("switches between the default locale and /pt", async ({ page }) => {
    await page.goto("/");

    const toPt = page.locator('[data-testid="lang-switcher"]');
    await expect(toPt).toBeVisible();
    await toPt.click();

    await expect(page).toHaveURL(/\/pt(\/)?$/);
    await expect(page.locator('[data-testid="lang-switcher"]')).toBeVisible();
  });

  test("serves the pt-BR articles listing", async ({ page }) => {
    await page.goto("/pt/articles");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('a[href*="/articles/"]').first()).toBeVisible();
  });

  test("the language switch preserves the current section", async ({ page }) => {
    await page.goto("/articles");
    await page.locator('[data-testid="lang-switcher"]').click();

    // /articles → /pt/articles (the section is kept, only the locale prefix changes).
    await expect(page).toHaveURL(/\/pt\/articles\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("opens a pt-BR article detail page", async ({ page }) => {
    await page.goto("/pt/articles");

    const card = page.locator('a[href*="/pt/articles/"]').first();
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/\/pt\/articles\//);
    await expect(page.getByTestId("page-title")).toBeVisible();
  });
});
