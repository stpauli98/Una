import { test, expect } from "@playwright/test";

test.describe("login open-redirect zaštita", () => {
  test("?redirect=https://evil.com je sanitizovan — prijava ide na default dashboard", async ({
    page,
  }) => {
    await page.goto("/admin/login?redirect=https://evil.com/path");

    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
    expect(page.url()).not.toContain("evil.com");
  });

  test("?redirect=//evil.com je sanitizovan", async ({ page }) => {
    await page.goto("/admin/login?redirect=//evil.com");

    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10_000 });
    expect(page.url()).not.toContain("evil.com");
  });

  test("?redirect=/admin/termini je legitiman i ispoštovan", async ({
    page,
  }) => {
    await page.goto("/admin/login?redirect=/admin/termini");

    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Prijavi se" }).click();

    await expect(page).toHaveURL(/\/admin\/termini/, { timeout: 10_000 });
  });
});
