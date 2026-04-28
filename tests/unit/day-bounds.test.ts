import { describe, it, expect } from "vitest";
import { getSarajevoDayBounds, sarajevoTodayDateStr, addDaysToDateStr } from "@/lib/utils/day-bounds";

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

  it("baca grešku za neispravan datum", () => {
    expect(() => addDaysToDateStr("nope", 1)).toThrow();
  });
});
