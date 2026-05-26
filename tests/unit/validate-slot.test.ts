import { describe, it, expect } from "vitest";
import { isSlotWithinWorkingHours, isDateBlocked, doTimesOverlap } from "@/lib/booking/validate-slot";

describe("isSlotWithinWorkingHours", () => {
  it("returns true when slot is within open/close times", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "10:00", "11:00")).toBe(true);
  });

  it("returns false when slot starts before open time", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "08:00", "09:30")).toBe(false);
  });

  it("returns false when slot ends after close time", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "16:30", "17:30")).toBe(false);
  });

  it("returns true when slot exactly matches working hours", () => {
    expect(isSlotWithinWorkingHours("09:00", "17:00", "09:00", "17:00")).toBe(true);
  });
});

describe("isDateBlocked", () => {
  it("returns true when date falls within a blocked range", () => {
    expect(isDateBlocked("2026-06-15", [
      { date_from: "2026-06-10", date_to: "2026-06-20" },
    ])).toBe(true);
  });

  it("returns false when date is outside all blocked ranges", () => {
    expect(isDateBlocked("2026-06-05", [
      { date_from: "2026-06-10", date_to: "2026-06-20" },
    ])).toBe(false);
  });

  it("returns true on boundary dates (inclusive)", () => {
    expect(isDateBlocked("2026-06-10", [
      { date_from: "2026-06-10", date_to: "2026-06-10" },
    ])).toBe(true);
  });

  it("returns false when no blocked dates exist", () => {
    expect(isDateBlocked("2026-06-15", [])).toBe(false);
  });
});

describe("doTimesOverlap", () => {
  it("detects overlap", () => {
    const start = new Date("2026-06-15T10:00:00Z");
    const end = new Date("2026-06-15T11:00:00Z");
    const blocks = [
      { start: new Date("2026-06-15T10:30:00Z"), end: new Date("2026-06-15T11:30:00Z") },
    ];
    expect(doTimesOverlap(start, end, blocks)).toBe(true);
  });

  it("returns false when no overlap", () => {
    const start = new Date("2026-06-15T10:00:00Z");
    const end = new Date("2026-06-15T11:00:00Z");
    const blocks = [
      { start: new Date("2026-06-15T11:00:00Z"), end: new Date("2026-06-15T12:00:00Z") },
    ];
    expect(doTimesOverlap(start, end, blocks)).toBe(false);
  });
});
