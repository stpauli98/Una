import { describe, it, expect } from "vitest";
import { parseSarajevoDateTime } from "@/lib/utils/tz";

describe("parseSarajevoDateTime", () => {
  it("interpretira HH:MM string kao wall-clock vrijeme u Sarajevo TZ (CEST/ljeto)", () => {
    // 15. juna je CEST (+02:00). 18:00 Sarajevo = 16:00 UTC.
    const d = parseSarajevoDateTime("2026-06-15", "18:00");
    expect(d.toISOString()).toBe("2026-06-15T16:00:00.000Z");
  });

  it("interpretira HH:MM string kao wall-clock vrijeme u Sarajevo TZ (CET/zima)", () => {
    // 15. januara je CET (+01:00). 18:00 Sarajevo = 17:00 UTC.
    const d = parseSarajevoDateTime("2026-01-15", "18:00");
    expect(d.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("podržava ponoć kao granični slučaj", () => {
    // 00:00 Sarajevo (CEST) = 22:00 UTC prethodnog dana.
    const d = parseSarajevoDateTime("2026-06-15", "00:00");
    expect(d.toISOString()).toBe("2026-06-14T22:00:00.000Z");
  });

  it("podržava :30 vrijednosti (booking grid)", () => {
    const d = parseSarajevoDateTime("2026-06-15", "18:30");
    expect(d.toISOString()).toBe("2026-06-15T16:30:00.000Z");
  });

  it("rezultat je nezavisan od procesa TZ (deterministički ISO)", () => {
    const a = parseSarajevoDateTime("2026-06-15", "18:00").toISOString();
    const b = parseSarajevoDateTime("2026-06-15", "18:00").toISOString();
    expect(a).toBe(b);
    expect(a).toBe("2026-06-15T16:00:00.000Z");
  });
});
