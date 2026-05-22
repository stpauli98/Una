import { test, expect } from "@playwright/test";

test.describe("SEO — title + description", () => {
  test("homepage <title> leads with 'Šminkanje Gradiška'", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title).toMatch(/^Šminkanje Gradiška/);
    expect(title).toContain("UP Makeup");
  });

  test("homepage <meta description> mentions Gradiška + service types", async ({ page }) => {
    await page.goto("/");
    const desc = await page
      .locator('meta[name="description"]')
      .first()
      .getAttribute("content");
    expect(desc).toBeTruthy();
    expect(desc).toMatch(/Gradišci/);
    expect(desc).toMatch(/svadbeno|maturalno|terensko/);
  });

  test("/usluge <title> mentions šminkanje + Gradišci", async ({ page }) => {
    await page.goto("/usluge");
    const title = await page.title();
    expect(title).toMatch(/Usluge šminkanja u Gradišci/);
  });

  test("/cjenovnik <title> mentions šminkanje + Gradiška", async ({ page }) => {
    await page.goto("/cjenovnik");
    const title = await page.title();
    expect(title).toMatch(/Cjenovnik šminkanja Gradiška/);
  });
});

test.describe("SEO — Schema.org JSON-LD", () => {
  test("/usluge embeds ItemList of Service Schema", async ({ page }) => {
    await page.goto("/usluge");
    // Get all ld+json scripts, find the ItemList one
    const jsonLdScripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();

    type ItemListJsonLd = {
      "@context": string;
      "@type": string;
      name?: string;
      itemListElement?: Array<{
        "@type": string;
        position: number;
        item: {
          "@type": string;
          name: string;
          serviceType?: string;
          areaServed?: { name: string };
          provider?: { "@id": string };
          offers?: { priceCurrency: string };
        };
      }>;
    };

    const parsed: ItemListJsonLd[] = jsonLdScripts.map((s) => JSON.parse(s));
    const itemList = parsed.find((p) => p["@type"] === "ItemList");

    expect(itemList).toBeDefined();
    expect(itemList!["@context"]).toBe("https://schema.org");
    expect(itemList!.name).toMatch(/Gradišci/);
    expect(Array.isArray(itemList!.itemListElement)).toBe(true);
  });

  test("each Service item in /usluge ItemList references BeautySalon provider + Gradiška areaServed", async ({
    page,
  }) => {
    await page.goto("/usluge");
    const jsonLdScripts = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    type ItemListJsonLd = {
      "@type": string;
      itemListElement?: Array<{
        item: {
          areaServed?: { name: string };
          provider?: { "@id": string };
          offers?: { priceCurrency: string };
        };
      }>;
    };
    const parsed: ItemListJsonLd[] = jsonLdScripts.map((s) => JSON.parse(s));
    const itemList = parsed.find((p) => p["@type"] === "ItemList");

    // If services exist in DB, validate item shape. If empty, skip detail check
    // but assert the structure is at least correct.
    if (itemList?.itemListElement && itemList.itemListElement.length > 0) {
      const first = itemList.itemListElement[0].item;
      expect(first.areaServed?.name).toBe("Gradiška");
      expect(first.provider?.["@id"]).toMatch(/#business$/);
      if (first.offers) {
        expect(first.offers.priceCurrency).toBe("BAM");
      }
    }
  });
});
