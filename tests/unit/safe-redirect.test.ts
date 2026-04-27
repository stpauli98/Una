import { describe, it, expect } from "vitest";
import { safeRedirect } from "@/lib/utils/safe-redirect";

describe("safeRedirect", () => {
  const fallback = "/admin/dashboard";

  it("accepts a same-origin path", () => {
    expect(safeRedirect("/admin/termini", fallback)).toBe("/admin/termini");
  });

  it("accepts a path with query string", () => {
    expect(safeRedirect("/admin/termini?status=ceka", fallback)).toBe(
      "/admin/termini?status=ceka",
    );
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirect("https://evil.com", fallback)).toBe(fallback);
    expect(safeRedirect("http://evil.com/path", fallback)).toBe(fallback);
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.com", fallback)).toBe(fallback);
    expect(safeRedirect("//evil.com/path", fallback)).toBe(fallback);
  });

  it("rejects backslash variant (some browsers normalize)", () => {
    expect(safeRedirect("/\\evil.com", fallback)).toBe(fallback);
    expect(safeRedirect("\\\\evil.com", fallback)).toBe(fallback);
  });

  it("rejects javascript: and data: schemes", () => {
    expect(safeRedirect("javascript:alert(1)", fallback)).toBe(fallback);
    expect(safeRedirect("data:text/html,<script>", fallback)).toBe(fallback);
  });

  it("returns fallback for undefined / empty / non-string input", () => {
    expect(safeRedirect(undefined, fallback)).toBe(fallback);
    expect(safeRedirect("", fallback)).toBe(fallback);
    expect(safeRedirect(null as unknown as string, fallback)).toBe(fallback);
  });
});
