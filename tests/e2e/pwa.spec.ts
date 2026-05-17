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

  test("serves maskable icon at /icons/maskable-512.png", async ({ request }) => {
    const res = await request.get("/icons/maskable-512.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  });
});

test.describe("iOS PWA meta", () => {
  test("html exposes mobile-web-app-capable", async ({ page }) => {
    await page.goto("/uslovi-koriscenja");
    // Next.js 16 emits the modern `mobile-web-app-capable` rather than the
    // deprecated `apple-mobile-web-app-capable` (iOS Safari honours both).
    const capable = await page
      .locator('meta[name="mobile-web-app-capable"]')
      .first()
      .getAttribute("content");
    expect(capable).toBe("yes");

    const title = await page
      .locator('meta[name="apple-mobile-web-app-title"]')
      .first()
      .getAttribute("content");
    expect(title).toBe("UP Beauty");

    const status = await page
      .locator('meta[name="apple-mobile-web-app-status-bar-style"]')
      .first()
      .getAttribute("content");
    expect(status).toBe("black-translucent");
  });

  test("viewport allows safe-area-inset (viewport-fit=cover)", async ({ page }) => {
    await page.goto("/uslovi-koriscenja");
    const viewport = await page
      .locator('meta[name="viewport"]')
      .first()
      .getAttribute("content");
    expect(viewport).toMatch(/viewport-fit=cover/);
  });
});

test.describe("Service worker", () => {
  test("registers a service worker", async ({ page }) => {
    await page.goto("/uslovi-koriscenja");
    // Serwist registers asynchronously after page load — wait until the SW
    // is fully activated before asserting (avoids a race on first visit).
    await page.waitForFunction(
      async () => {
        if (!("serviceWorker" in navigator)) return false;
        const reg = await navigator.serviceWorker.ready;
        return reg.active?.state === "activated";
      },
      null,
      { timeout: 10_000 },
    );
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active?.state === "activated";
    });
    expect(registered).toBe(true);
  });

  test("/sw.js is served as JavaScript", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/javascript/);
  });
});
