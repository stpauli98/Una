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
