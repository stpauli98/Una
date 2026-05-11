import { test, expect } from "@playwright/test";

test.describe("landing hero minimalist (varijanta B)", () => {
  test("renderuje 'manje je više' slogan + Una portret", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Slogan je <h1> sa 'manje je / više.'
    await expect(
      page.getByRole("heading", { level: 1, name: /manje je\s+više/i }),
    ).toBeVisible();

    // Una portret je tu — provjeravamo src kroz srcset (unaHero.png)
    await expect(
      page.locator('img[srcset*="unaHero"]').first(),
    ).toBeAttached();
  });

  test("CTAs vode na pravu stranicu", async ({ page }) => {
    await page.goto("/");

    // Zakaži termin → /zakazi
    await expect(
      page.getByRole("link", { name: "Zakaži termin" }).first(),
    ).toHaveAttribute("href", /\/zakazi/);

    // Saznaj više → /o-meni
    await expect(
      page.getByRole("link", { name: /Saznaj više/i }).first(),
    ).toHaveAttribute("href", /\/o-meni/);
  });

  test("social linkovi u hero footeru vode na Instagram i TikTok", async ({
    page,
  }) => {
    await page.goto("/");

    // Scope na hero sekciju (postojeći Footer takođe ima IG link, pa moramo skratiti).
    // Hero ima aria-label="Instagram UP Beauty" — drugi nemaju "UP Beauty" suffix.
    await expect(
      page.getByRole("link", { name: "Instagram UP Beauty" }),
    ).toHaveAttribute("href", /instagram\.com/);

    await expect(
      page.getByRole("link", { name: "TikTok UP Beauty" }),
    ).toHaveAttribute("href", /tiktok\.com/);
  });
});
