import { describe, it, expect } from "vitest";
import { parseBookingSettings } from "@/lib/settings/read";

describe("parseBookingSettings", () => {
  it("parsira sve 4 ključa iz DB redova", () => {
    const rows = [
      { key: "min_hours_before", value: "6" },
      { key: "advance_booking_days", value: "30" },
      { key: "cancellation_hours", value: "12" },
      { key: "break_between_min", value: "10" },
    ];
    const result = parseBookingSettings(rows);
    expect(result).toEqual({
      minHoursBefore: 6,
      advanceBookingDays: 30,
      cancellationHours: 12,
      breakBetweenMin: 10,
    });
  });

  it("fallback na BOOKING_RULES default kad ključ nedostaje", () => {
    const rows = [{ key: "min_hours_before", value: "3" }];
    const result = parseBookingSettings(rows);
    expect(result.minHoursBefore).toBe(3);
    expect(result.advanceBookingDays).toBe(90);
    expect(result.cancellationHours).toBe(24);
    expect(result.breakBetweenMin).toBe(0);
  });

  it("fallback na default kad je value neispravan (NaN)", () => {
    const rows = [{ key: "min_hours_before", value: "abc" }];
    const result = parseBookingSettings(rows);
    expect(result.minHoursBefore).toBe(24);
  });

  it("prazna lista → svi defaults", () => {
    const result = parseBookingSettings([]);
    expect(result).toEqual({
      minHoursBefore: 24,
      advanceBookingDays: 90,
      cancellationHours: 24,
      breakBetweenMin: 0,
    });
  });
});
