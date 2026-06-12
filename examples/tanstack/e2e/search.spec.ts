import { expect, test } from "@playwright/test";

// Standardized across every create-muttum-app template. The articles listing has
// a native GET search form (`<form method="get">` with `input[name="q"]` + a
// submit button); submitting navigates to `?q=…` and the server re-runs the
// HyperDown FTS query. Detail-card links contain `/articles/`, so their presence
// (or absence) is the result-count signal — tag/pagination links don't match.

test.describe("Search", () => {
  test("a matching query keeps results", async ({ page }) => {
    await page.goto("/articles");

    await page.locator('input[name="q"]').fill("hyper");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/articles\?q=hyper\b/);
    await expect(page.locator('a[href*="/articles/"]').first()).toBeVisible();
  });

  test("a non-matching query shows the empty state", async ({ page }) => {
    await page.goto("/articles");

    await page.locator('input[name="q"]').fill("zzqqxxnomatch");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/q=zzqqxxnomatch/);
    await expect(page.locator('a[href*="/articles/"]')).toHaveCount(0);
  });
});
