import { test, expect } from "@playwright/test";

test.describe("security headers", () => {
  test("homepage emits CSP report-only header", async ({ request }) => {
    const res = await request.get("/");
    const csp = res.headers()["content-security-policy-report-only"];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    // Supabase storage hostname mora biti u img-src za galeriju
    expect(csp).toContain("img-src");
  });

  test("homepage emits standardne hardening headere", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});
