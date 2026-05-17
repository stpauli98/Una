import { test, expect } from "@playwright/test";

test.describe("Branded favicon", () => {
  test("/favicon.ico is served and is not the Next.js scaffold default", async ({ request }) => {
    const res = await request.get("/favicon.ico");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);
    const buf = await res.body();
    // ICO magic number: 0x00 0x00 0x01 0x00 (reserved + type=icon)
    expect(buf[0]).toBe(0);
    expect(buf[1]).toBe(0);
    expect(buf[2]).toBe(1);
    expect(buf[3]).toBe(0);
    // Sanity: not the 25931-byte scaffold default.
    // New ICO with 3 sizes (16/32/48) is typically 5-15 KB.
    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(buf.byteLength).toBeLessThan(20000);
  });
});

test.describe("OpenGraph URL", () => {
  for (const path of ["/", "/usluge", "/cjenovnik", "/galerija", "/o-meni", "/kontakt", "/obuka", "/zakazi"]) {
    test(`${path} emits <meta property="og:url"> matching canonical`, async ({ page }) => {
      await page.goto(path);
      const ogUrl = await page
        .locator('meta[property="og:url"]')
        .first()
        .getAttribute("content");
      expect(ogUrl).toBeTruthy();
      // og:url should be the absolute URL matching canonical, ending with the page path
      // (root path '/' → ends with .vercel.app or .vercel.app/)
      if (path === "/") {
        expect(ogUrl).toMatch(/\.vercel\.app\/?$/);
      } else {
        expect(ogUrl).toMatch(new RegExp(`${path.replace(/\//g, "\\/")}\\/?$`));
      }
    });
  }
});
