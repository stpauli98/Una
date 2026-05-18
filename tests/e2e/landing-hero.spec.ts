import { test, expect } from "@playwright/test";

// HERO_IMAGES[0] (13bbdadb) je u OBE varijanti (HeroStatic i HeroAnimated jako prva).
// HERO_IMAGES[1] (1c3f575a) je SAMO u HeroAnimated (druga slika u bento grid-u).
// Pa prisustvo druge slike je dokaz da je animated aktivan.
const FIRST_IMAGE_HASH = "13bbdadb";
const SECOND_IMAGE_HASH = "1c3f575a";

test.describe("landing hero", () => {
  test("mobile viewport prikazuje static hero (samo prva slika, naslov, CTAs)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Naslov vidljiv u viewport-u (CTAs mogu biti ispod fold-a na 375x667)
    await expect(
      page.getByRole("heading", { level: 1, name: /Osmijeh je/i }),
    ).toBeVisible();
    // CTAs postoje u DOM-u (toBeAttached, ne treba visibility check zbog viewport-a).
    // `.first()` jer nav takođe ima link "Zakaži termin".
    await expect(
      page.getByRole("link", { name: "Zakaži termin" }).first(),
    ).toBeAttached();
    await expect(
      page.getByRole("link", { name: "Pogledaj usluge" }).first(),
    ).toBeAttached();

    // Prva hero slika je tu
    await expect(
      page.locator(`img[srcset*="${FIRST_IMAGE_HASH}"]`).first(),
    ).toBeAttached();

    // Druga slika (samo u HeroAnimated bento grid-u) — NE SMIJE biti prisutna na mobile
    await expect(
      page.locator(`img[srcset*="${SECOND_IMAGE_HASH}"]`),
    ).toHaveCount(0);
  });

  test("desktop viewport prikazuje animated hero (bento sa više slika)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Naslov vidljiv
    await expect(
      page.getByRole("heading", { level: 1, name: /Osmijeh je/i }),
    ).toBeVisible();

    // Druga slika je prisutna → HeroAnimated je hidriran
    await expect(
      page.locator(`img[srcset*="${SECOND_IMAGE_HASH}"]`).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("CTAs vode na pravu stranicu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "Zakaži termin" }).first(),
    ).toHaveAttribute("href", /\/zakazi/);

    await expect(
      page.getByRole("link", { name: "Pogledaj usluge" }).first(),
    ).toHaveAttribute("href", /\/usluge/);
  });
});
