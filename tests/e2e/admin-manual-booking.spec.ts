import { test, expect } from "@playwright/test";
import { cleanupByName, SERVICE_ROLE_KEY } from "./helpers";
import { addDays, getDay, format } from "date-fns";

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  return date;
}

test("admin manually creates appointment → appears in termini list", async ({
  page,
}) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";
  test.skip(!SERVICE_ROLE_KEY, "E2E_SUPABASE_SERVICE_ROLE_KEY needed");

  const testClientName = `E2E Manual ${Date.now()}`;

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Lozinka").fill(adminPassword);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Go to termini
    await page.goto("/admin/termini");
    await page.getByRole("button", { name: /Dodaj termin/ }).click();
    await expect(
      page.getByRole("heading", { name: "Dodaj termin" }),
    ).toBeVisible();

    // Fill form
    await page.getByLabel("Ime klijenta").fill(testClientName);
    await page.getByLabel("Telefon").fill("+38765999000");

    // Switch to custom time mode
    await page.getByRole("button", { name: /Prilagođeno vrijeme/ }).click();

    // Fill date + time
    const target = nextBookableWeekday();
    const dateStr = format(target, "yyyy-MM-dd");
    await page.locator('input[name="custom_date"]').fill(dateStr);
    await page.locator('select[name="custom_time"]').selectOption("19:30");

    await page.getByRole("button", { name: "Sačuvaj" }).click();

    // Verify in list
    await expect(page.getByText(testClientName)).toBeVisible({ timeout: 5000 });
  } finally {
    await cleanupByName(testClientName);
  }
});
