import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { computeAvailableSlots } from "@/lib/booking/availability";
import type { DailyHoursMap } from "@/lib/booking/rules";
import type { BookingSettings } from "@/lib/settings/read";
import { atSarajevo, TZ } from "@/lib/utils/tz";
import type {
  BlockedRange,
  ExistingAppointment,
  Slot,
} from "@/types/booking";

/**
 * Svi testovi konstruišu i čitaju datume u Sarajevo TZ-u (bez obzira na
 * server-local TZ). Engine je TZ-aware (Vercel UTC ili lokalni Sarajevo
 * dev — isti rezultat).
 *
 * Slot grid je fiksnih 30 minuta (SLOT_INTERVAL_MIN). Trajanje usluge se
 * koristi samo za overlap check — posljednji slot mora završiti ≤ close.
 *
 * Datumi:
 *   2026-04-06 — PONEDJELJAK
 *   2026-04-07 — utorak (weekday: 17:00–21:00)
 *   2026-04-11 — subota (weekend: 05:00–21:00)
 *   2026-04-12 — nedjelja (weekend: 05:00–21:00)
 */

const hhmm = (slots: Slot[]) =>
  slots.map((s) => formatInTimeZone(s.start, TZ, "HH:mm"));

/** Ponoć tog dana u Sarajevo TZ. */
const day = (y: number, m: number, d: number) => atSarajevo(y, m, d, 0, 0);

/** Određeni sat/minuta tog dana u Sarajevo TZ. */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  atSarajevo(y, m, d, h, min);

// "sada" = ponedjeljak 2026-04-06 10:00 — daleko prije 17:00 termina sutra/sljedećih dana.
const NOW_FAR = at(2026, 4, 6, 10, 0);

describe("computeAvailableSlots — weekday (utorak)", () => {
  it("60-min usluga, bez postojećih → slotovi na 30-min gridu 17:00..20:00", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).toEqual([
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });

  it("120-min usluga, bez postojećih → slotovi na 30-min gridu dok end ≤ close", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 120,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    // 19:00 start → 21:00 end (tačno close, ok)
    // 19:30 start → 21:30 end (prelazi close, isključeno)
    expect(hhmm(slots)).toEqual([
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
    ]);
  });

  it("180-min usluga, bez postojećih → slotovi na 30-min gridu dok end ≤ close", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 180,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    // 18:00 start → 21:00 end (tačno close, ok)
    // 18:30 start → 21:30 end (prelazi close, isključeno)
    expect(hhmm(slots)).toEqual(["17:00", "17:30", "18:00"]);
  });

  it("postojeći termin 18:00–19:00 blokira preklapajuće slotove, ostavlja ostale", () => {
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 18), end: at(2026, 4, 7, 19) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
    });
    // 17:00 [17-18] granica — NE overlaipuje (end == start) — slobodno
    // 17:30 [17:30-18:30] — overlaipuje — blokirano
    // 18:00 [18-19] — overlaipuje — blokirano
    // 18:30 [18:30-19:30] — overlaipuje — blokirano
    // 19:00 [19-20] — granica — slobodno
    // 19:30 [19:30-20:30] — slobodno
    // 20:00 [20-21] — slobodno
    expect(hhmm(slots)).toEqual(["17:00", "19:00", "19:30", "20:00"]);
  });

  it("postojeći termin 17:30–18:30 blokira sve preklapajuće 60-min slotove", () => {
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17, 30), end: at(2026, 4, 7, 18, 30) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
    });
    // 17:00 [17-18] overlaipuje sa [17:30-18:30] — blokirano
    // 17:30 [17:30-18:30] potpuno preklapa — blokirano
    // 18:00 [18-19] overlaipuje — blokirano
    // 18:30 [18:30-19:30] granica — slobodno
    // 19:00, 19:30, 20:00 — slobodni
    expect(hhmm(slots)).toEqual(["18:30", "19:00", "19:30", "20:00"]);
  });

  it("30-min termin u 17:00 → sljedeći 60-min slot je u 17:30 (korisnikov scenario)", () => {
    // Scenario koji je korisnik opisao u brainstorming-u:
    // Trepavice 30min u 17:00 → sljedeći klijent bira Šminkanje 60min → 17:30
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17, 0), end: at(2026, 4, 7, 17, 30) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
    });
    // 17:00 [17-18] overlaipuje sa [17:00-17:30] — blokirano
    // 17:30 [17:30-18:30] granica — SLOBODNO (prvi slobodan odmah poslije)
    // 18:00, 18:30, 19:00, 19:30, 20:00 — slobodni
    expect(hhmm(slots)).toEqual([
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
    expect(hhmm(slots)[0]).toBe("17:30");
  });
});

describe("computeAvailableSlots — weekend (subota)", () => {
  it("60-min usluga subota, bez postojećih → 31 slot na 30-min gridu", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 11),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    // 05:00 start → 06:00 end (ok)
    // Posljednji: 20:00 start → 21:00 end
    // Broj: od 05:00 do 20:00 u koracima 30 min = 31 slot
    expect(slots).toHaveLength(31);
    expect(hhmm(slots)[0]).toBe("05:00");
    expect(hhmm(slots).at(-1)).toBe("20:00");
  });

  it("120-min nedjelja, bez postojećih → slotovi na 30-min gridu do 19:00 starta", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 12),
      durationMin: 120,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    // 05:00 do 19:00 start (19:00 + 120min = 21:00 = close), svakih 30 min
    // 05:00, 05:30, ..., 19:00 = 29 slotova
    expect(slots).toHaveLength(29);
    expect(hhmm(slots)[0]).toBe("05:00");
    expect(hhmm(slots).at(-1)).toBe("19:00");
  });
});

describe("computeAvailableSlots — blokirani datumi", () => {
  it("blokirani datum koji pokriva ciljani dan → prazno", () => {
    const blocked: BlockedRange[] = [
      { from: day(2026, 4, 7), to: day(2026, 4, 7) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked,
    });
    expect(slots).toEqual([]);
  });

  it("blokirani raspon koji obuhvata ciljani dan → prazno", () => {
    const blocked: BlockedRange[] = [
      { from: day(2026, 4, 5), to: day(2026, 4, 10) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked,
    });
    expect(slots).toEqual([]);
  });

  it("blokirani raspon koji NE obuhvata ciljani dan → normalni slotovi", () => {
    const blocked: BlockedRange[] = [
      { from: day(2026, 4, 1), to: day(2026, 4, 3) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked,
    });
    expect(hhmm(slots)).toEqual([
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });
});

describe("computeAvailableSlots — hoursByWeekday override", () => {
  it("isključen dan → prazan array", () => {
    const closedTuesday: DailyHoursMap = {
      2: { open: "00:00", close: "00:00", isOpen: false },
    };
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7), // utorak
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      hoursByWeekday: closedTuesday,
    });
    expect(slots).toEqual([]);
  });

  it("kraće radno vrijeme smanjuje broj slotova", () => {
    const shortTuesday: DailyHoursMap = {
      2: { open: "19:00", close: "21:00", isOpen: true },
    };
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      hoursByWeekday: shortTuesday,
    });
    // 19:00 [19-20] OK, 19:30 [19:30-20:30] OK, 20:00 [20-21] OK
    expect(hhmm(slots)).toEqual(["19:00", "19:30", "20:00"]);
  });

  it("proširenje radnog vremena povećava broj slotova (uzima min_hours_before u obzir)", () => {
    const longTuesday: DailyHoursMap = {
      2: { open: "08:00", close: "12:00", isOpen: true },
    };
    // NOW_FAR = 2026-04-06 10:00. Utorak 08:00 je 22h poslije → isključeno.
    // Utorak 09:00 je 23h poslije → isključeno.
    // Utorak 09:30 je 23.5h → isključeno.
    // Utorak 10:00 je 24h → uključeno (border).
    // Utorak 10:30 → uključeno.
    // Utorak 11:00 → uključeno (11:00 start + 60min = 12:00 close).
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      hoursByWeekday: longTuesday,
    });
    expect(hhmm(slots)).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("parcijalna mapa: nedostaje ključ za dan → BOOKING_RULES default", () => {
    const partialMap: DailyHoursMap = {
      1: { open: "10:00", close: "12:00", isOpen: true }, // samo ponedjeljak
    };
    // Utorak (day_of_week=2) nije u mapi, treba pasti na BOOKING_RULES (17-21)
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      hoursByWeekday: partialMap,
    });
    expect(hhmm(slots)).toEqual([
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });

  it("prazna mapa → svi dani fallback-uju na BOOKING_RULES", () => {
    const emptyMap: DailyHoursMap = {};
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      hoursByWeekday: emptyMap,
    });
    expect(hhmm(slots)).toEqual([
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });
});

describe("computeAvailableSlots — time blocks", () => {
  it("time block 18:00-19:00 blokira preklapajuće slotove", () => {
    const blockedTimes: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 18), end: at(2026, 4, 7, 19) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      blockedTimes,
    });
    // 17:00 [17-18] granica — slobodno
    // 17:30 [17:30-18:30] — overlaipuje — blokirano
    // 18:00 [18-19] — overlaipuje — blokirano
    // 18:30 [18:30-19:30] — overlaipuje — blokirano
    // 19:00 [19-20] — granica — slobodno
    // 19:30, 20:00 — slobodni
    expect(hhmm(slots)).toEqual(["17:00", "19:00", "19:30", "20:00"]);
  });

  it("time block 17:30-18:30 (off-grid) blokira sve preklapajuće", () => {
    const blockedTimes: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17, 30), end: at(2026, 4, 7, 18, 30) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      blockedTimes,
    });
    expect(hhmm(slots)).not.toContain("17:00");
    expect(hhmm(slots)).not.toContain("17:30");
    expect(hhmm(slots)).not.toContain("18:00");
    expect(hhmm(slots)).toContain("18:30");
    expect(hhmm(slots)).toContain("19:00");
  });

  it("time block + existing termin — oba se kompozira", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [{ start: at(2026, 4, 7, 17), end: at(2026, 4, 7, 18) }],
      blocked: [],
      blockedTimes: [{ start: at(2026, 4, 7, 19), end: at(2026, 4, 7, 20) }],
    });
    // existing 17-18 blokira 17:00 [17-18], 17:30 [17:30-18:30]
    // blockedTime 19-20 blokira 18:30 [18:30-19:30], 19:00 [19-20], 19:30 [19:30-20:30]
    // 18:00 [18-19] — OK (granica sa oboje)
    // 20:00 [20-21] — OK (granica sa blockedTime)
    expect(hhmm(slots)).toEqual(["18:00", "20:00"]);
  });

  it("prazan blockedTimes → identično sa ne-prosljeđivanjem", () => {
    const withEmpty = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
      blockedTimes: [],
    });
    const without = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(hhmm(withEmpty)).toEqual(hhmm(without));
    expect(hhmm(withEmpty)).toEqual([
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });
});

describe("computeAvailableSlots — skipMinHoursBefore (admin)", () => {
  it("skipMinHoursBefore=true dozvoljava slotove unutar 24h", () => {
    // sad: utorak 18:00 → slot u srijedu 17:00 je za 23h
    // Bez skipMinHoursBefore: 17:00 i 17:30 isključeni
    // Sa skipMinHoursBefore: svi slotovi dostupni
    const now = at(2026, 4, 7, 18, 0);
    const slots = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
      skipMinHoursBefore: true,
    });
    expect(hhmm(slots)).toContain("17:00");
    expect(hhmm(slots)).toContain("17:30");
    expect(hhmm(slots)).toContain("18:00");
  });

  it("skipMinHoursBefore=false ponašanje identično sa ne-prosljeđivanjem", () => {
    const now = at(2026, 4, 7, 18, 0);
    const withFalse = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
      skipMinHoursBefore: false,
    });
    const without = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
    });
    expect(hhmm(withFalse)).toEqual(hhmm(without));
    expect(hhmm(withFalse)).not.toContain("17:00");
  });
});

describe("computeAvailableSlots — vremenske granice", () => {
  it("min_hours_before (24h): slotovi < 24h od sada su isključeni", () => {
    // sad: utorak 18:00 → slot u srijedu 17:00 je za 23h → isključen
    // slot u srijedu 17:30 je za 23.5h → isključen
    // slot u srijedu 19:00 je za 25h → uključen
    const now = at(2026, 4, 7, 18, 0);
    const slots = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).not.toContain("17:00");
    expect(hhmm(slots)).not.toContain("17:30");
    expect(hhmm(slots)).toContain("19:00");
  });

  it("advance_booking_days (90): datum 91 dan u budućnosti → prazno", () => {
    const now = day(2026, 4, 6);
    const target = new Date(now);
    target.setDate(target.getDate() + 91);
    const slots = computeAvailableSlots({
      date: target,
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
    });
    expect(slots).toEqual([]);
  });

  it("advance_booking_days (90): datum 89 dan u budućnosti → slotovi postoje", () => {
    const now = day(2026, 4, 6);
    const target = new Date(now);
    target.setDate(target.getDate() + 89);
    const slots = computeAvailableSlots({
      date: target,
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it("datum u prošlosti → prazno", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 1),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(slots).toEqual([]);
  });
});

const FULL_SETTINGS: BookingSettings = {
  minHoursBefore: 24,
  advanceBookingDays: 90,
  cancellationHours: 24,
  breakBetweenMin: 0,
};

describe("computeAvailableSlots — configurable settings", () => {
  it("settings.advanceBookingDays override (30 dana umjesto 90)", () => {
    const now = day(2026, 4, 6);
    const target = new Date(now);
    target.setDate(target.getDate() + 35);
    const slots = computeAvailableSlots({
      date: target,
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
      settings: { ...FULL_SETTINGS, advanceBookingDays: 30 },
    });
    expect(slots).toEqual([]);
  });

  it("settings.minHoursBefore override (3h umjesto 24h)", () => {
    const now = at(2026, 4, 7, 18, 0);
    const slots = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
      settings: { ...FULL_SETTINGS, minHoursBefore: 3 },
    });
    expect(hhmm(slots)).toContain("17:00");
    expect(hhmm(slots)).toContain("17:30");
  });

  it("break_between_min=10 → slot nakon termina pomjeren za 10 min", () => {
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17), end: at(2026, 4, 7, 18) },
    ];
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
      settings: { ...FULL_SETTINGS, breakBetweenMin: 10 },
    });
    // Termin 17:00-18:00 + 10min break = efektivno do 18:10
    // 18:00 [18-19] overlaipuje sa [17:00-18:10] → blokirano
    // 18:30 [18:30-19:30] → ne overlaipuje (18:30 > 18:10) → slobodno
    expect(hhmm(slots)).not.toContain("17:00");
    expect(hhmm(slots)).not.toContain("17:30");
    expect(hhmm(slots)).not.toContain("18:00");
    expect(hhmm(slots)).toContain("18:30");
    expect(hhmm(slots)).toContain("19:00");
  });

  it("break_between_min=0 → identično bez settings parametra", () => {
    const existing: ExistingAppointment[] = [
      { start: at(2026, 4, 7, 17), end: at(2026, 4, 7, 18) },
    ];
    const withBreak = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
      settings: { ...FULL_SETTINGS, breakBetweenMin: 0 },
    });
    const without = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing,
      blocked: [],
    });
    expect(hhmm(withBreak)).toEqual(hhmm(without));
  });
});
