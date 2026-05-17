import { test, expect } from "@playwright/test";

test.describe("PWA manifest", () => {
  test("serves valid web app manifest at /manifest.webmanifest", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/manifest+json");
    const m = await res.json();
    expect(m.name).toBe("UP Beauty & Makeup Studio — Gradiška");
    expect(m.short_name).toBe("UP Beauty");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#3d2b2b");
    expect(m.background_color).toBe("#faf7f2");
    expect(m.lang).toBe("sr-Latn");
    expect(m.icons.length).toBeGreaterThanOrEqual(3);
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  });

  test("layout html links the manifest", async ({ page }) => {
    await page.goto("/uslovi-koriscenja"); // pure-static page, no Supabase dep
    const href = await page.locator('link[rel="manifest"]').first().getAttribute("href");
    expect(href).toMatch(/manifest\.webmanifest/);
  });
});

test.describe("PWA icons", () => {
  for (const path of ["/icon", "/icon1", "/apple-icon"]) {
    test(`serves ${path} as PNG`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const buf = await res.body();
      expect(buf.byteLength).toBeGreaterThan(500);
    });
  }

  test("layout html has apple-touch-icon link", async ({ page }) => {
    await page.goto("/uslovi-koriscenja");
    const href = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute("href");
    expect(href).toMatch(/apple-icon/);
  });
});
