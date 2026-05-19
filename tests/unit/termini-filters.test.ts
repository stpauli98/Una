import { describe, it, expect } from "vitest";
import { buildAppointmentsBoundsFilter } from "@/lib/utils/termini-filters";
import { getSarajevoDayBounds, sarajevoTodayDateStr } from "@/lib/utils/day-bounds";

describe("buildAppointmentsBoundsFilter", () => {
  it("date setovan → koristi getSarajevoDayBounds, range se ignoriše", () => {
    const result = buildAppointmentsBoundsFilter({
      date: "2026-05-19",
      range: "mjesec",
    });
    const expected = getSarajevoDayBounds("2026-05-19");
    expect(result).toEqual({
      kind: "bounded",
      gte: expected.start,
      lt: expected.end,
    });
  });

  it("range='svi' → unbounded", () => {
    const result = buildAppointmentsBoundsFilter({
      date: undefined,
      range: "svi",
    });
    expect(result).toEqual({ kind: "unbounded" });
  });

  it("range='danas' u 23:30 Sarajevo daje iste bounds kao ?date=<today> (REGRESSION NALAZ A)", () => {
    // 23:30 Sarajevo zima = 22:30 UTC isti dan
    const nowLateNight = new Date("2026-01-15T22:30:00.000Z");
    const today = sarajevoTodayDateStr(nowLateNight);

    const rangeResult = buildAppointmentsBoundsFilter(
      { date: undefined, range: "danas" },
      nowLateNight,
    );
    const dateResult = buildAppointmentsBoundsFilter(
      { date: today, range: "svi" },
      nowLateNight,
    );
    expect(rangeResult).toEqual(dateResult);
  });

  it("range='danas' u ranojutarnjem 00:30 Sarajevo (UTC prethodni dan) — koristi Sarajevo today", () => {
    // 00:30 Sarajevo zima = 23:30 UTC prethodni dan
    const nowEarlyMorning = new Date("2026-01-15T23:30:00.000Z");
    const today = sarajevoTodayDateStr(nowEarlyMorning); // 2026-01-16

    const result = buildAppointmentsBoundsFilter(
      { date: undefined, range: "danas" },
      nowEarlyMorning,
    );
    const expected = getSarajevoDayBounds(today);
    expect(result).toEqual({
      kind: "bounded",
      gte: expected.start,
      lt: expected.end,
    });
  });

  it("range='sedmica' koristi getSarajevoWeekBounds(today)", () => {
    // 2026-05-20 srijeda u 14:00 Sarajevo CEST = 12:00 UTC
    const wedNoon = new Date("2026-05-20T12:00:00.000Z");
    const result = buildAppointmentsBoundsFilter(
      { date: undefined, range: "sedmica" },
      wedNoon,
    );
    // Sedmica = pon 18. maj → pon 25. maj
    expect(result).toEqual({
      kind: "bounded",
      gte: "2026-05-17T22:00:00.000Z",
      lt: "2026-05-24T22:00:00.000Z",
    });
  });

  it("range='mjesec' koristi getSarajevoMonthBounds(today)", () => {
    // 2026-05-15
    const may15Noon = new Date("2026-05-15T12:00:00.000Z");
    const result = buildAppointmentsBoundsFilter(
      { date: undefined, range: "mjesec" },
      may15Noon,
    );
    expect(result).toEqual({
      kind: "bounded",
      gte: "2026-04-30T22:00:00.000Z",
      lt: "2026-05-31T22:00:00.000Z",
    });
  });
});
