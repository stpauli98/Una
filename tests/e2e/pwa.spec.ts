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

test.describe("Offline fallback", () => {
  test("renders /~offline as a static page", async ({ page }) => {
    await page.goto("/~offline");
    await expect(page.locator("h1")).toContainText(/bez konekcije|offline/i);
    await expect(page.getByRole("link", { name: /pokušaj ponovo|nazad/i })).toBeVisible();
  });
});

test.describe("Admin PWA scope", () => {
  test("serves admin manifest at /admin/manifest.webmanifest", async ({ request }) => {
    const res = await request.get("/admin/manifest.webmanifest");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/manifest+json");
    const m = await res.json();
    expect(m.id).toBe("/admin");
    expect(m.name).toBe("UP Beauty Admin");
    expect(m.short_name).toBe("UP Admin");
    expect(m.start_url).toBe("/admin/dashboard");
    expect(m.scope).toBe("/admin");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#3d2b2b");
    expect(m.background_color).toBe("#faf7f2");
    expect(m.lang).toBe("sr-Latn");
    expect(m.icons.length).toBeGreaterThanOrEqual(3);
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    expect(m.icons.some((i: { src: string }) => i.src === "/admin/icon")).toBe(true);
  });

  for (const path of ["/admin/icon", "/admin/icon1", "/admin/apple-icon"]) {
    test(`serves ${path} as PNG`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const buf = await res.body();
      expect(buf.byteLength).toBeGreaterThan(500);
    });
  }

  test("serves admin maskable icon at /icons/admin-maskable-512.png", async ({ request }) => {
    const res = await request.get("/icons/admin-maskable-512.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  });

  test("admin login page links the admin manifest (not the root manifest)", async ({ page }) => {
    await page.goto("/admin/login");
    const href = await page
      .locator('link[rel="manifest"]')
      .first()
      .getAttribute("href");
    expect(href).toMatch(/\/admin\/manifest\.webmanifest/);
  });

  test("admin login page has apple-mobile-web-app-title=UP Admin", async ({ page }) => {
    await page.goto("/admin/login");
    const title = await page
      .locator('meta[name="apple-mobile-web-app-title"]')
      .first()
      .getAttribute("content");
    expect(title).toBe("UP Admin");

    const appName = await page
      .locator('meta[name="application-name"]')
      .first()
      .getAttribute("content");
    expect(appName).toBe("UP Beauty Admin");
  });

  test("public page still links the root manifest", async ({ page }) => {
    await page.goto("/uslovi-koriscenja");
    const href = await page
      .locator('link[rel="manifest"]')
      .first()
      .getAttribute("href");
    expect(href).toMatch(/\/manifest\.webmanifest$/);
    expect(href).not.toMatch(/\/admin\//);
  });

  test("InstallPrompt component is not rendered on /admin/*", async ({ page }) => {
    await page.goto("/admin/login");
    const onAdminMarker = await page.evaluate(() => document.body.dataset.installPromptMounted);
    expect(onAdminMarker).toBeUndefined();

    await page.goto("/uslovi-koriscenja");
    const onPublicMarker = await page.evaluate(() => document.body.dataset.installPromptMounted);
    expect(onPublicMarker).toBe("true");
  });

  test("CookieBanner is not rendered on /admin/*", async ({ page }) => {
    // Clear consent so the banner WOULD show on public if we navigated there.
    await page.goto("/admin/login");
    await page.evaluate(() => localStorage.removeItem("up-beauty-cookie-consent"));

    // Admin: wait past the 800ms delay; banner must NOT appear.
    await page.goto("/admin/login");
    await page.waitForTimeout(1200);
    await expect(page.getByRole("dialog", { name: /kolačićima/i })).toHaveCount(0);

    // Public sanity check: banner DOES appear after the delay on public.
    await page.goto("/uslovi-koriscenja");
    await expect(page.getByRole("dialog", { name: /kolačićima/i })).toBeVisible({
      timeout: 2000,
    });
  });
});

test.describe("Nav a11y", () => {
  test("Escape closes mobile menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/uslovi-koriscenja");
    const hamburger = page.getByRole("button", { name: /otvori meni/i });
    await hamburger.click();
    // The mobile overlay renders large display-font links — scope to those
    // (footer also has a "Usluge" link with much smaller styling).
    const overlayLink = page.locator("a.font-display", { hasText: /^Usluge$/ });
    await expect(overlayLink).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlayLink).toHaveCount(0);
    // Hamburger should return to "Otvori meni" label after close
    await expect(hamburger).toBeVisible();
  });
});
