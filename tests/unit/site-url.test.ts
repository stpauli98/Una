import { describe, it, expect } from "vitest";
import { normalizeSiteUrl } from "@/lib/utils/site-url";

describe("normalizeSiteUrl", () => {
  it("returns clean URL unchanged", () => {
    expect(normalizeSiteUrl("https://up-beauty.vercel.app")).toBe(
      "https://up-beauty.vercel.app",
    );
  });

  it("strips trailing slash", () => {
    expect(normalizeSiteUrl("https://up-beauty.vercel.app/")).toBe(
      "https://up-beauty.vercel.app",
    );
  });

  it("strips trailing newline (Vercel env var bug)", () => {
    expect(normalizeSiteUrl("https://up-beauty.vercel.app\n")).toBe(
      "https://up-beauty.vercel.app",
    );
  });

  it("strips trailing whitespace combinations", () => {
    expect(normalizeSiteUrl("https://up-beauty.vercel.app \t\n")).toBe(
      "https://up-beauty.vercel.app",
    );
  });

  it("strips trailing newline AND slash together", () => {
    expect(normalizeSiteUrl("https://up-beauty.vercel.app/\n")).toBe(
      "https://up-beauty.vercel.app",
    );
    expect(normalizeSiteUrl("https://up-beauty.vercel.app\n/")).toBe(
      "https://up-beauty.vercel.app",
    );
  });

  it("uses fallback when input is undefined", () => {
    expect(normalizeSiteUrl(undefined)).toBe("http://localhost:3000");
  });

  it("respects custom fallback", () => {
    expect(normalizeSiteUrl(undefined, "https://example.test")).toBe(
      "https://example.test",
    );
  });

  it("normalizes fallback too (in case it has trailing slash)", () => {
    expect(normalizeSiteUrl(undefined, "https://example.test/")).toBe(
      "https://example.test",
    );
  });

  it("does NOT strip internal whitespace or newline", () => {
    // Sanity: only TRAILING whitespace is stripped, not characters mid-URL.
    expect(normalizeSiteUrl("https://up beauty.vercel.app")).toBe(
      "https://up beauty.vercel.app",
    );
  });
});
