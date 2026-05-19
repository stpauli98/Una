import { describe, it, expect } from "vitest";
import {
  getSarajevoDayBounds,
  getSarajevoWeekBounds,
  sarajevoTodayDateStr,
  addDaysToDateStr,
} from "@/lib/utils/day-bounds";

describe("getSarajevoDayBounds", () => {
  it("vraća Sarajevo midnight..next-midnight ISO za dati datum", () => {
    const { start, end } = getSarajevoDayBounds("2026-05-04");
    // Maj = CEST (UTC+2). Sarajevo 00:00 = 22:00 UTC prethodnog dana.
    expect(start).toBe("2026-05-03T22:00:00.000Z");
    expect(end).toBe("2026-05-04T22:00:00.000Z");
  });

  it("ispravno radi i pri prelasku DST (mart 2026 kraj zime, oktobar 2026 kraj ljetnog vremena)", () => {
    // Mart 28, 2026 (subota prije DST-a, CET = UTC+1) → 23:00 UTC
    const winter = getSarajevoDayBounds("2026-03-28");
    expect(winter.start).toBe("2026-03-27T23:00:00.000Z");

    // Oktobar 25, 2026 (nedjelja - zadnji dan CEST-a, UTC+2) → 22:00 UTC
    // DST završava 25. okt u 03:00 CEST → 02:00 CET (sat unazad).
    // Ponoć 25. okt je još uvijek CEST (UTC+2), tj. 22:00 UTC.
    const summer = getSarajevoDayBounds("2026-10-25");
    expect(summer.start).toBe("2026-10-24T22:00:00.000Z");
  });

  it("spring-forward dan (29. mart 2026) — start CET, end CEST", () => {
    // 29. mart 2026 = nedjelja DST start. Sarajevo dan je samo 23 stvarna sata.
    const { start, end } = getSarajevoDayBounds("2026-03-29");
    expect(start).toBe("2026-03-28T23:00:00.000Z"); // 00:00 CET
    expect(end).toBe("2026-03-29T22:00:00.000Z"); // 00:00 CEST sljedećeg dana
  });

  it("fall-back dan (25. okt 2026) — start CEST, end CET", () => {
    // 25. okt 2026 = nedjelja DST end. Sarajevo dan je 25 stvarnih sati.
    const { start, end } = getSarajevoDayBounds("2026-10-25");
    expect(start).toBe("2026-10-24T22:00:00.000Z"); // 00:00 CEST
    expect(end).toBe("2026-10-25T23:00:00.000Z"); // 00:00 CET sljedećeg dana
  });

  it("baca grešku za neispravan datum string", () => {
    expect(() => getSarajevoDayBounds("not-a-date")).toThrow();
    expect(() => getSarajevoDayBounds("")).toThrow();
    expect(() => getSarajevoDayBounds("2026-13-01")).toThrow();
  });
});

describe("sarajevoTodayDateStr", () => {
  it("vraća YYYY-MM-DD u Sarajevo TZ za dato 'now'", () => {
    // 2026-05-03 23:00 UTC = 01:00 Sarajevo Maj 4 (CEST)
    const lateNightUtc = new Date("2026-05-03T23:00:00.000Z");
    expect(sarajevoTodayDateStr(lateNightUtc)).toBe("2026-05-04");

    // 2026-05-04 12:00 UTC = 14:00 Sarajevo Maj 4
    const middayUtc = new Date("2026-05-04T12:00:00.000Z");
    expect(sarajevoTodayDateStr(middayUtc)).toBe("2026-05-04");
  });
});

describe("addDaysToDateStr", () => {
  it("dodaje pozitivne dane", () => {
    expect(addDaysToDateStr("2026-05-04", 1)).toBe("2026-05-05");
    expect(addDaysToDateStr("2026-05-04", 7)).toBe("2026-05-11");
  });

  it("dodaje negativne dane (povratak)", () => {
    expect(addDaysToDateStr("2026-05-04", -1)).toBe("2026-05-03");
  });

  it("prelazi mjesečnu granicu", () => {
    expect(addDaysToDateStr("2026-04-30", 1)).toBe("2026-05-01");
    expect(addDaysToDateStr("2026-05-01", -1)).toBe("2026-04-30");
  });

  it("ispravan u DST tranzicijama (oktobar 2026)", () => {
    // 25. okt 2026 = nedjelja DST kraj. addDays preko atSarajevo ne smije
    // biti pomjeren od TZ shift-a.
    expect(addDaysToDateStr("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("days = 0 → vraća isti datum", () => {
    expect(addDaysToDateStr("2026-05-04", 0)).toBe("2026-05-04");
  });

  it("prelazi godišnju granicu", () => {
    expect(addDaysToDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateStr("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("baca grešku za neispravan datum", () => {
    expect(() => addDaysToDateStr("nope", 1)).toThrow();
  });
});

describe("getSarajevoWeekBounds", () => {
  it("vraća ponedjeljak 00:00 — sljedeći ponedjeljak 00:00 za mid-week datum", () => {
    // 2026-05-20 = srijeda. Ponedjeljak iste sedmice = 2026-05-18.
    const { start, end } = getSarajevoWeekBounds("2026-05-20");
    // Maj = CEST (UTC+2), Sarajevo ponoć = 22:00 UTC prethodnog dana
    expect(start).toBe("2026-05-17T22:00:00.000Z"); // 2026-05-18 00:00 CEST
    expect(end).toBe("2026-05-24T22:00:00.000Z");   // 2026-05-25 00:00 CEST
  });

  it("input je sam ponedjeljak — start je taj dan", () => {
    const { start, end } = getSarajevoWeekBounds("2026-05-18");
    expect(start).toBe("2026-05-17T22:00:00.000Z");
    expect(end).toBe("2026-05-24T22:00:00.000Z");
  });

  it("input je nedjelja — vraća prethodni ponedjeljak", () => {
    // 2026-05-24 = nedjelja. Ponedjeljak iste sedmice = 2026-05-18.
    const { start, end } = getSarajevoWeekBounds("2026-05-24");
    expect(start).toBe("2026-05-17T22:00:00.000Z");
    expect(end).toBe("2026-05-24T22:00:00.000Z");
  });

  it("DST proljeće — sedmica koja sadrži spring-forward (29. mart 2026)", () => {
    // 29. mart 2026 = nedjelja DST start. Sedmica: pon 23. mart → pon 30. mart.
    const { start, end } = getSarajevoWeekBounds("2026-03-29");
    // 23. mart 00:00 CET = 23:00 UTC 22. marta
    expect(start).toBe("2026-03-22T23:00:00.000Z");
    // 30. mart 00:00 CEST = 22:00 UTC 29. marta
    expect(end).toBe("2026-03-29T22:00:00.000Z");
  });

  it("DST jesen — sedmica koja sadrži fall-back (25. okt 2026)", () => {
    // 25. okt 2026 = nedjelja DST end. Sedmica: pon 19. okt → pon 26. okt.
    const { start, end } = getSarajevoWeekBounds("2026-10-25");
    // 19. okt 00:00 CEST = 22:00 UTC 18. okt
    expect(start).toBe("2026-10-18T22:00:00.000Z");
    // 26. okt 00:00 CET = 23:00 UTC 25. okt
    expect(end).toBe("2026-10-25T23:00:00.000Z");
  });

  it("sedmica preko godine (decembar 2026 → januar 2027)", () => {
    // 2026-12-30 = srijeda. Sedmica: pon 28. dec 2026 → pon 4. jan 2027.
    const { start, end } = getSarajevoWeekBounds("2026-12-30");
    // Decembar = CET (UTC+1)
    expect(start).toBe("2026-12-27T23:00:00.000Z");
    expect(end).toBe("2027-01-03T23:00:00.000Z");
  });

  it("baca grešku za neispravan datum", () => {
    expect(() => getSarajevoWeekBounds("not-a-date")).toThrow();
    expect(() => getSarajevoWeekBounds("2026-13-01")).toThrow();
  });
});
