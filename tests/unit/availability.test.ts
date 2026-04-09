import { describe, it, expect } from "vitest";
import { computeAvailableSlots } from "@/lib/booking/availability";
import type {
  BlockedRange,
  ExistingAppointment,
  Slot,
} from "@/types/booking";

/**
 * Svi testovi koriste lokalna vremena (bez TZ suffix) — booking logika
 * radi u lokalnoj TZ koju browser/server interpretira. Za CI stabilnost
 * to je dovoljno jer svi test datumi koriste isti sistem.
 *
 * Datumi:
 *   2026-04-06 — PONEDJELJAK
 *   2026-04-07 — utorak (weekday: 17:00–21:00)
 *   2026-04-11 — subota (weekend: 05:00–21:00)
 *   2026-04-12 — nedjelja (weekend: 05:00–21:00)
 */

const hhmm = (slots: Slot[]) =>
  slots.map(
    (s) =>
      `${String(s.start.getHours()).padStart(2, "0")}:${String(
        s.start.getMinutes(),
      ).padStart(2, "0")}`,
  );

/** Ponoć tog dana (lokalno). */
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 0, 0, 0);

/** Određeni sat/minuta tog dana (lokalno). */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0);

// "sada" = ponedjeljak 2026-04-06 10:00 — daleko prije 17:00 termina sutra/sljedećih dana.
const NOW_FAR = at(2026, 4, 6, 10, 0);

describe("computeAvailableSlots — weekday (utorak)", () => {
  it("60-min usluga, bez postojećih → slotovi 17:00, 18:00, 19:00, 20:00", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).toEqual(["17:00", "18:00", "19:00", "20:00"]);
  });

  it("120-min usluga, bez postojećih → 17:00, 19:00 (20:00 bi završio u 22:00)", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 120,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).toEqual(["17:00", "19:00"]);
  });

  it("180-min usluga, bez postojećih → samo 17:00 (17→20 ok, 20→23 nema vremena)", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 7),
      durationMin: 180,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).toEqual(["17:00"]);
  });

  it("postojeći termin 18:00–19:00 uklanja 18:00 slot ali ostavlja 17:00 i 19:00", () => {
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
    expect(hhmm(slots)).toEqual(["17:00", "19:00", "20:00"]);
  });

  it("postojeći termin 17:30–18:30 briše 17:00 i 18:00 slot (overlap)", () => {
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
    expect(hhmm(slots)).toEqual(["19:00", "20:00"]);
  });
});

describe("computeAvailableSlots — weekend (subota)", () => {
  it("60-min usluga, bez postojećih → 16 slotova 05:00..20:00", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 11),
      durationMin: 60,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(slots).toHaveLength(16);
    expect(hhmm(slots)[0]).toBe("05:00");
    expect(hhmm(slots).at(-1)).toBe("20:00");
  });

  it("120-min nedjelja, bez postojećih → 05:00, 07:00, ..., 19:00 (8 slotova)", () => {
    const slots = computeAvailableSlots({
      date: day(2026, 4, 12),
      durationMin: 120,
      now: NOW_FAR,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).toEqual([
      "05:00",
      "07:00",
      "09:00",
      "11:00",
      "13:00",
      "15:00",
      "17:00",
      "19:00",
    ]);
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
    expect(hhmm(slots)).toEqual(["17:00", "18:00", "19:00", "20:00"]);
  });
});

describe("computeAvailableSlots — vremenske granice", () => {
  it("min_hours_before (24h): 17:00 slot za sljedeci dan kad je sad 18:00 → isključen (< 24h)", () => {
    // sad: utorak 16:00 → slot u srijedu 17:00 je za 25h (ok, uključen)
    // sad: utorak 18:00 → slot u srijedu 17:00 je za 23h (isključen)
    const now = at(2026, 4, 7, 18, 0);
    const slots = computeAvailableSlots({
      date: day(2026, 4, 8),
      durationMin: 60,
      now,
      existing: [],
      blocked: [],
    });
    expect(hhmm(slots)).not.toContain("17:00");
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
