import { describe, it, expect } from "vitest";
import { hoursMapFromRows, getHoursForDay } from "@/lib/booking/rules";

describe("hoursMapFromRows", () => {
  it("pretvara DB redove u mapu i skraćuje sekunde", () => {
    const rows = [
      {
        day_of_week: 1,
        open_time: "17:00:00",
        close_time: "21:00:00",
        is_open: true,
      },
      {
        day_of_week: 6,
        open_time: "05:00:00",
        close_time: "21:00:00",
        is_open: true,
      },
      {
        day_of_week: 0,
        open_time: "00:00:00",
        close_time: "00:00:00",
        is_open: false,
      },
    ];
    const map = hoursMapFromRows(rows);
    expect(map[1]).toEqual({ open: "17:00", close: "21:00", isOpen: true });
    expect(map[6]).toEqual({ open: "05:00", close: "21:00", isOpen: true });
    expect(map[0]).toEqual({ open: "00:00", close: "00:00", isOpen: false });
  });

  it("prazna lista → prazna mapa", () => {
    expect(hoursMapFromRows([])).toEqual({});
  });

  it("tolera 'HH:mm' format bez sekundi", () => {
    const rows = [
      {
        day_of_week: 3,
        open_time: "17:00",
        close_time: "21:00",
        is_open: true,
      },
    ];
    const map = hoursMapFromRows(rows);
    expect(map[3]).toEqual({ open: "17:00", close: "21:00", isOpen: true });
  });
});

describe("getHoursForDay (fallback)", () => {
  it("weekday 1 (ponedjeljak) → 17:00-21:00", () => {
    expect(getHoursForDay(1)).toEqual({
      open: "17:00",
      close: "21:00",
      isOpen: true,
    });
  });

  it("weekend 6 (subota) → 05:00-21:00", () => {
    expect(getHoursForDay(6)).toEqual({
      open: "05:00",
      close: "21:00",
      isOpen: true,
    });
  });
});
