import { describe, it, expect } from "vitest";
import { getMonthAvailability } from "@/lib/booking/month-availability";
import { hoursMapFromRows } from "@/lib/booking/rules";
import { BOOKING_RULES } from "@/lib/constants/business";

const HOURS_MON_FRI_9_TO_17 = [
  { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_open: true },
  { day_of_week: 2, open_time: "09:00", close_time: "17:00", is_open: true },
  { day_of_week: 3, open_time: "09:00", close_time: "17:00", is_open: true },
  { day_of_week: 4, open_time: "09:00", close_time: "17:00", is_open: true },
  { day_of_week: 5, open_time: "09:00", close_time: "17:00", is_open: true },
];

describe("getMonthAvailability", () => {
  it("returns true for every weekday when nothing is booked", () => {
    const result = getMonthAvailability({
      year: 2026,
      month: 6, // jun 2026
      durationMin: 60,
      now: new Date("2026-05-15T08:00:00Z"),
      existing: [],
      blocked: [],
      hoursByWeekday: hoursMapFromRows(HOURS_MON_FRI_9_TO_17),
      blockedTimes: [],
      settings: BOOKING_RULES,
    });

    // 2026-06-01 je ponedjeljak — radni dan, prazan, treba true
    expect(result["2026-06-01"]).toBe(true);
    // 2026-06-06 je subota — nije u HOURS_MON_FRI, treba false
    expect(result["2026-06-06"]).toBe(false);
  });

  it("returns false for fully booked weekday", () => {
    // Cijeli ponedjeljak 2026-06-01 09:00-17:00 popunjen jednim appointment
    const result = getMonthAvailability({
      year: 2026,
      month: 6,
      durationMin: 60,
      now: new Date("2026-05-15T08:00:00Z"),
      existing: [
        {
          start: new Date("2026-06-01T07:00:00.000Z"), // 09:00 Sarajevo (UTC+2)
          end: new Date("2026-06-01T15:00:00.000Z"), // 17:00 Sarajevo
        },
      ],
      blocked: [],
      hoursByWeekday: hoursMapFromRows(HOURS_MON_FRI_9_TO_17),
      blockedTimes: [],
      settings: BOOKING_RULES,
    });

    expect(result["2026-06-01"]).toBe(false);
    // Drugi dani ostaju otvoreni
    expect(result["2026-06-02"]).toBe(true);
  });

  it("returns false for blocked date", () => {
    const result = getMonthAvailability({
      year: 2026,
      month: 6,
      durationMin: 60,
      now: new Date("2026-05-15T08:00:00Z"),
      existing: [],
      blocked: [
        {
          from: new Date("2026-06-03T00:00:00.000Z"),
          to: new Date("2026-06-03T00:00:00.000Z"),
        },
      ],
      hoursByWeekday: hoursMapFromRows(HOURS_MON_FRI_9_TO_17),
      blockedTimes: [],
      settings: BOOKING_RULES,
    });

    expect(result["2026-06-03"]).toBe(false);
  });

  it("covers all days of the month (including weekends)", () => {
    const result = getMonthAvailability({
      year: 2026,
      month: 6,
      durationMin: 60,
      now: new Date("2026-05-15T08:00:00Z"),
      existing: [],
      blocked: [],
      hoursByWeekday: hoursMapFromRows(HOURS_MON_FRI_9_TO_17),
      blockedTimes: [],
      settings: BOOKING_RULES,
    });

    // Jun 2026 ima 30 dana
    expect(Object.keys(result)).toHaveLength(30);
    expect(result["2026-06-01"]).toBeDefined();
    expect(result["2026-06-30"]).toBeDefined();
  });
});
