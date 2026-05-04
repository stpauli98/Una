import { test, expect, type Page } from "@playwright/test";
import { SUPABASE_URL, SERVICE_ROLE_KEY, supabaseHeaders } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "test@admin.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Test1234A";
// Jedinstveni naziv po run-u — global-setup ne briše services tabelu, pa
// koristimo timestamp suffix + ručni cleanup u afterAll-u.
const SERVICE_NAME = `E2E Test Usluga sa slikom ${Date.now()}`;

/**
 * Tiny 1×1 transparent PNG (67 bytes). Ima validne magic bytes pa će sharp
 * metadata() ga prihvatiti. Dovoljno za upload validaciju, bez potrebe
 * za pisanjem fajla na disk.
 */
function loadFixture(): { name: string; mimeType: string; buffer: Buffer } {
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100200400000000000049454e44ae426082",
    "hex",
  );
  return { name: "test.png", mimeType: "image/png", buffer: png };
}

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Lozinka").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

/** Cleanup: briše service po nazivu (i prateće storage objekte preko cascade nije moguće — radimo manualno). */
async function cleanupService(name: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  // Pronađi service da uzmemo image_path (ako postoji) i obrišemo sliku iz storage-a.
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/services?name=eq.${encodeURIComponent(name)}&select=id,image_path`,
    { headers: supabaseHeaders() },
  );
  if (findRes.ok) {
    const rows = (await findRes.json()) as Array<{
      id: number;
      image_path: string | null;
    }>;
    for (const row of rows) {
      if (row.image_path) {
        await fetch(
          `${SUPABASE_URL}/storage/v1/object/services/${row.image_path}`,
          { method: "DELETE", headers: supabaseHeaders() },
        );
      }
    }
  }
  await fetch(
    `${SUPABASE_URL}/rest/v1/services?name=eq.${encodeURIComponent(name)}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}

test.describe.serial("admin service image upload + remove", () => {
  test.skip(
    !SERVICE_ROLE_KEY,
    "E2E_SUPABASE_SERVICE_ROLE_KEY needed for cleanup",
  );

  test.afterAll(async () => {
    await cleanupService(SERVICE_NAME);
  });

  test("kreira novu uslugu sa slikom — slika se prikazuje na /usluge", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/admin/usluge");

    // Otvori "Nova usluga" formu
    await page.getByRole("button", { name: "Nova usluga" }).click();
    await expect(
      page.getByRole("heading", { name: "Nova usluga" }),
    ).toBeVisible();

    // Popuni obavezna polja
    await page.locator('input[name="name"]').fill(SERVICE_NAME);
    await page.locator('input[name="price"]').fill("50");
    await page
      .locator('select[name="category"]')
      .selectOption("sminkanje");

    // Upload slike kroz hidden file input
    const fixture = loadFixture();
    await page.locator('input[type="file"]').setInputFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.buffer,
    });

    // Sačekaj da kompresija završi i preview se prikaže ("Nova slika · ... KB")
    await expect(page.getByText(/Nova slika/i)).toBeVisible({
      timeout: 15000,
    });

    // Submit
    await page.getByRole("button", { name: "Sačuvaj" }).click();

    // Forma se zatvara nakon uspješnog save-a (onSaved → onClose)
    await expect(
      page.getByRole("heading", { name: "Nova usluga" }),
    ).toBeHidden({ timeout: 10000 });

    // Provjeri da je usluga u admin listi
    await expect(
      page.getByRole("heading", { name: SERVICE_NAME, level: 4 }),
    ).toBeVisible();

    // Provjeri da javna /usluge stranica prikazuje sliku za ovu uslugu.
    // Karta se renderuje kao <article> sa <h4>{name}</h4> + <Image>.
    await page.goto("/usluge");
    const heading = page.getByRole("heading", {
      name: SERVICE_NAME,
      level: 4,
    });
    await expect(heading).toBeVisible();

    const card = heading.locator("xpath=ancestor::article[1]");
    const img = card.locator("img").first();
    await expect(img).toBeVisible();
    // Next/Image src obično ide kroz /_next/image proxy sa storage URL u "url" param-u
    await expect(img).toHaveAttribute(
      "src",
      /\/storage\/v1\/object\/public\/services\/|_next\/image\?.*services/,
    );
  });

  test("ukloni sliku sa kreirane usluge — slika nestaje sa /usluge", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/admin/usluge");

    // Pronađi karticu usluge i klikni "Izmijeni"
    const card = page
      .getByRole("heading", { name: SERVICE_NAME, level: 4 })
      .locator("xpath=ancestor::div[contains(@class, 'border') and contains(@class, 'bg-white')][1]");
    await card.getByRole("button", { name: "Izmijeni" }).click();

    // Modal se otvara
    await expect(
      page.getByRole("heading", { name: "Izmijeni uslugu" }),
    ).toBeVisible();

    // U image sekciji, prikazuje se "Trenutna slika" sa "Zamijeni" + "Ukloni" dugmadima
    await expect(page.getByText("Trenutna slika")).toBeVisible();
    await page.getByRole("button", { name: "Ukloni" }).click();

    // Verifikuj banner "Slika će biti uklonjena pri save-u"
    await expect(
      page.getByText(/Slika će biti uklonjena/i),
    ).toBeVisible();

    // Submit
    await page.getByRole("button", { name: "Sačuvaj" }).click();

    // Forma se zatvara
    await expect(
      page.getByRole("heading", { name: "Izmijeni uslugu" }),
    ).toBeHidden({ timeout: 10000 });

    // Provjeri da javna /usluge stranica više nema sliku za ovu uslugu —
    // umjesto img-a se prikazuje fallback gradijent sa kategorijskom ikonom.
    await page.goto("/usluge");
    const heading = page.getByRole("heading", {
      name: SERVICE_NAME,
      level: 4,
    });
    await expect(heading).toBeVisible();
    const cardPublic = heading.locator("xpath=ancestor::article[1]");
    await expect(cardPublic.locator("img")).toHaveCount(0);
  });
});
