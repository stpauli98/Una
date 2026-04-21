import { test, expect } from "@playwright/test";

/**
 * E2E: admin otvara otkazani termin i WhatsApp dugme mora da nosi
 * poruku o otkazivanju (ne potvrdu).
 *
 * Preduslov: lokalna baza ima najmanje jedan otkazani termin. Test ga
 * kreira preko javne booking API rute pa ga otkazuje preko admin server
 * action-a indirektno — lakše: direktan SQL insert nije moguć iz Playwright-a,
 * pa umjesto toga filtriramo kartice u UI i očekujemo da postoji barem jedan
 * 'otkazan' u mjesec view-u. Ako ga nema, test se skipuje.
 */
test("admin canceled appointment → WhatsApp button carries cancellation message", async ({
  page,
}) => {
  // Login — koristi env varijable da se ne commit-uje lozinka u git
  const email = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Lozinka").fill(password);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);

  // Idi na termine sa otkazan filterom
  await page.goto("/admin/termini?status=otkazan");
  await expect(
    page.getByRole("heading", { name: "Termini" }),
  ).toBeVisible();

  // Ako nema otkazanih termina — skip umjesto lažnog fail-a
  const emptyState = page.getByText("Nema termina za izabrani filter.");
  if (await emptyState.isVisible().catch(() => false)) {
    test.skip(true, "nema otkazanih termina u bazi za test");
  }

  // Nađi WhatsApp dugme na prvom otkazanom terminu i provjeri tekst
  const waLink = page
    .locator('a[href*="wa.me"]')
    .first();
  await expect(waLink).toBeVisible();

  // Dugme mora nositi 'otkaz' label
  await expect(waLink).toContainText(/otkaz/i);

  // Dekoduj href i provjeri da poruka sadrži "otkazati" a ne "Potvrđujem"
  const href = await waLink.getAttribute("href");
  expect(href).toBeTruthy();
  const decoded = decodeURIComponent(href!.split("text=")[1] ?? "");
  expect(decoded).toContain("moram otkazati");
  expect(decoded).toContain("Izvinjavam se");
  expect(decoded).not.toContain("Potvrđujem vaš termin");
});
