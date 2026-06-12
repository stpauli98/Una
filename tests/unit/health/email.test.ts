import { describe, it, expect } from "vitest";
import { buildEmailSubject, buildEmailHtml } from "../../../scripts/health/lib/email.mjs";

const results = [
  { id: "ok", layer: "code", status: "PASS", detail: "fino" },
  { id: "rls-policies", layer: "prod", status: "FAIL", detail: "RLS drift: changed appointments/anon insert", expected: "X", actual: "Y" },
  { id: "booking-age", layer: "signals", status: "WARN", detail: "18 dana" },
];

describe("buildEmailSubject", () => {
  it("broji FAIL i WARN", () => {
    expect(buildEmailSubject(results, new Date("2026-06-12T10:00:00Z"))).toBe("[UP Health] 1 FAIL, 1 WARN — 12.06.2026 12:00");
  });
});

describe("buildEmailHtml", () => {
  it("sadrži samo WARN/FAIL redove, escape-uje HTML", () => {
    const html = buildEmailHtml([...results, { id: "x", layer: "prod", status: "FAIL", detail: "<script>alert(1)</script>" }]);
    expect(html).toContain("rls-policies");
    expect(html).toContain("booking-age");
    expect(html).not.toContain(">ok<");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
