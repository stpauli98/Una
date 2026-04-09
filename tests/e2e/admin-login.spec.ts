import { test, expect } from "@playwright/test";

test("admin login flow — valid credentials", async ({ page }) => {
  const email =
    process.env.E2E_ADMIN_EMAIL ?? "peranovicuna6@gmail.com";
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!password) {
    test.skip(true, "E2E_ADMIN_PASSWORD env var nije postavljen");
  }

  // Neautentifikovan pristup se redirectuje na login
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login/);

  // Login forma
  await expect(page.getByRole("heading", { name: "Admin panel" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Lozinka").fill(password!);
  await page.getByRole("button", { name: "Prijavi se" }).click();

  // Dashboard se učitava nakon logina
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(/Termini danas/).first()).toBeVisible();
});

test("admin login — invalid credentials", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("wrong@example.com");
  await page.getByLabel("Lozinka").fill("wrongpassword");
  await page.getByRole("button", { name: "Prijavi se" }).click();

  await expect(
    page.getByText("Neispravan email ili lozinka"),
  ).toBeVisible();
});
