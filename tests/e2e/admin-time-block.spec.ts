import { test, expect } from "@playwright/test";
import { addDays, getDay, format } from "date-fns";
import { SERVICE_ROLE_KEY } from "./helpers";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";

test.describe.configure({ mode: "serial" });

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 7);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  return date;
}

async function cleanupBlockByReason(reason: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/time_blocks?reason=eq.${encodeURIComponent(reason)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
}

test("admin creates time block → public calendar hides overlapping slot", async ({
  page,
}) => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";
  test.skip(!SERVICE_ROLE_KEY, "E2E_SUPABASE_SERVICE_ROLE_KEY needed");

  const uniqueReason = `E2E block ${Date.now()}`;
  const target = nextBookableWeekday();
  const dateStr = format(target, "yyyy-MM-dd");

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(adminEmail);
    await page.getByLabel("Lozinka").fill(adminPassword);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Go to postavke
    await page.goto("/admin/postavke");
    await expect(
      page.getByRole("heading", { name: /Blokirani intervali/ }),
    ).toBeVisible();

    // Scope to the time blocks form (has start_time_select)
    const tbForm = page
      .locator("form")
      .filter({ has: page.locator('select[name="start_time_select"]') });
    await tbForm.locator('input[name="block_date"]').fill(dateStr);
    await tbForm.locator('select[name="start_time_select"]').selectOption("18:00");
    await tbForm.locator('select[name="end_time_select"]').selectOption("19:00");
    await tbForm.locator('input[name="reason"]').fill(uniqueReason);
    await tbForm.getByRole("button", { name: /Dodaj/ }).click();

    // Block appears in list
    await expect(page.getByText(uniqueReason)).toBeVisible({ timeout: 5000 });

    // Check public calendar
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();
    // Wait for API to load slots
    await page.waitForTimeout(2000);

    const slots = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Block is 18:00-19:00 → 18:00 must be hidden
    expect(slots).not.toContain("18:00");
    // 17:00 should still be available, 19:00 should be available
    expect(slots).toContain("17:00");
    expect(slots).toContain("19:00");
  } finally {
    await cleanupBlockByReason(uniqueReason);
  }
});
