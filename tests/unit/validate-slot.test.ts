import { describe, it, expect } from "vitest";
import {
  isSlotWithinWorkingHours,
  isDateBlocked,
  doTimesOverlap,
  sarajevoDayOfWeek,
} from "@/lib/booking/validate-slot";

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

  // Postgres `time` kolone round-trip-uju sa sekundama ("05:00:00").
  // Leksikografski "05:00" < "05:00:00" pa je prvi slot dana padao kao
  // "van radnog vremena" (prod bug: subota 05:00, radno vrijeme 05:00–20:00).
  it("accepts slot starting exactly at open time when DB times carry seconds", () => {
    expect(isSlotWithinWorkingHours("05:00:00", "20:00:00", "05:00", "06:30")).toBe(true);
  });

  it("accepts slot ending exactly at close time when DB times carry seconds", () => {
    expect(isSlotWithinWorkingHours("09:00:00", "17:00:00", "16:30", "17:00")).toBe(true);
  });

  it("still rejects out-of-hours slots when DB times carry seconds", () => {
    expect(isSlotWithinWorkingHours("09:00:00", "17:00:00", "08:30", "10:00")).toBe(false);
    expect(isSlotWithinWorkingHours("09:00:00", "17:00:00", "16:30", "17:30")).toBe(false);
  });
});

describe("sarajevoDayOfWeek", () => {
  // Mora se slagati sa DB konvencijom working_hours.day_of_week (0=ned..6=sub)
  // i sa availability engine-om (toZonedTime(date, TZ).getDay()). Stari kod
  // je koristio date-fns token "e" (1=ned..7=sub u default locale) % 7, što je
  // svaki dan mapiralo na red SLJEDEĆEG dana (sub→0=ned, ned→1=pon, ...).
  it("maps Saturday to 6 (prod bug: 13. jun 2026 05:00 Sarajevo)", () => {
    expect(sarajevoDayOfWeek(new Date("2026-06-13T03:00:00Z"))).toBe(6);
  });

  it("maps Sunday to 0 and Monday to 1", () => {
    expect(sarajevoDayOfWeek(new Date("2026-06-14T10:00:00Z"))).toBe(0);
    expect(sarajevoDayOfWeek(new Date("2026-06-15T10:00:00Z"))).toBe(1);
  });

  it("uses Sarajevo wall-clock day, not UTC day", () => {
    // 2026-06-12 22:30 UTC = subota 13. jun 00:30 u Sarajevu (CEST, UTC+2)
    expect(sarajevoDayOfWeek(new Date("2026-06-12T22:30:00Z"))).toBe(6);
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
