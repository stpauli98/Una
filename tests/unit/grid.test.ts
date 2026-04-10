import { describe, it, expect } from "vitest";
import { assertGridAligned, isGridAligned } from "@/lib/utils/grid";

describe("isGridAligned", () => {
  it("accepts :00", () => {
    expect(isGridAligned(new Date("2026-04-15T17:00:00Z"))).toBe(true);
  });
  it("accepts :30", () => {
    expect(isGridAligned(new Date("2026-04-15T17:30:00Z"))).toBe(true);
  });
  it("rejects :15", () => {
    expect(isGridAligned(new Date("2026-04-15T17:15:00Z"))).toBe(false);
  });
  it("rejects :10", () => {
    expect(isGridAligned(new Date("2026-04-15T17:10:00Z"))).toBe(false);
  });
  it("rejects :45", () => {
    expect(isGridAligned(new Date("2026-04-15T17:45:00Z"))).toBe(false);
  });
  it("rejects :01", () => {
    expect(isGridAligned(new Date("2026-04-15T17:01:00Z"))).toBe(false);
  });
});

describe("assertGridAligned", () => {
  it("does not throw for :00", () => {
    expect(() =>
      assertGridAligned(new Date("2026-04-15T17:00:00Z")),
    ).not.toThrow();
  });
  it("does not throw for :30", () => {
    expect(() =>
      assertGridAligned(new Date("2026-04-15T17:30:00Z")),
    ).not.toThrow();
  });
  it("throws for :17 with descriptive message", () => {
    expect(() =>
      assertGridAligned(new Date("2026-04-15T17:17:00Z")),
    ).toThrow(/mora biti na :00 ili :30/);
  });
});
