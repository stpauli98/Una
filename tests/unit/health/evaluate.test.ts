import { describe, it, expect } from "vitest";
import { evaluateFkProbe, evaluateSlotsShape, slotWithinHours, evaluateBookingAge } from "../../../scripts/health/lib/evaluate.mjs";

describe("evaluateFkProbe", () => {
  it("23503 (FK violation) = PASS — cijeli put upisa zdrav", () => {
    const r = evaluateFkProbe(409, { code: "23503", message: "violates foreign key" });
    expect(r.status).toBe("PASS");
  });
  it("42501 = FAIL — RLS polomljen (lekcija bf82018)", () => {
    const r = evaluateFkProbe(403, { code: "42501", message: "row-level security" });
    expect(r.status).toBe("FAIL");
    expect(r.detail).toContain("RLS");
  });
  it("401 = FAIL — anon ključ nevalidan", () => {
    expect(evaluateFkProbe(401, { message: "Invalid API key" }).status).toBe("FAIL");
  });
  it("neočekivan uspjeh (201) = FAIL — proba NE smije proći", () => {
    expect(evaluateFkProbe(201, {}).status).toBe("FAIL");
  });
});

describe("evaluateSlotsShape", () => {
  it("validan odgovor sa slotovima = PASS", () => {
    const r = evaluateSlotsShape("2026-06-13", 200, { slots: [{ start: "2026-06-13T03:00:00.000Z", end: "2026-06-13T04:00:00.000Z" }] });
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
  });
  it("ne-200 ili pogrešan oblik = not ok", () => {
    expect(evaluateSlotsShape("2026-06-13", 500, {}).ok).toBe(false);
    expect(evaluateSlotsShape("2026-06-13", 200, { slots: [{ start: "x" }] }).ok).toBe(false);
  });
});

describe("slotWithinHours", () => {
  // subota 13.06.2026. 05:00 Sarajevo = 03:00Z; radno 05:00-20:00 — stvarni bug scenario
  const hours = { 6: { open: "05:00", close: "20:00", isOpen: true } };
  it("slot na granici otvaranja prolazi", () => {
    expect(slotWithinHours("2026-06-13T03:00:00.000Z", "2026-06-13T04:30:00.000Z", hours)).toBe(true);
  });
  it("slot prije otvaranja pada", () => {
    expect(slotWithinHours("2026-06-13T02:00:00.000Z", "2026-06-13T03:00:00.000Z", hours)).toBe(false);
  });
  it("zatvoren dan pada", () => {
    expect(slotWithinHours("2026-06-13T03:00:00.000Z", "2026-06-13T04:00:00.000Z", { 6: { open: "05:00", close: "20:00", isOpen: false } })).toBe(false);
  });
});

describe("evaluateBookingAge", () => {
  it("ispod praga = PASS, iznad = WARN", () => {
    expect(evaluateBookingAge(3, 14).status).toBe("PASS");
    expect(evaluateBookingAge(20, 14).status).toBe("WARN");
  });
  it("null (nijedna javna rezervacija) = WARN", () => {
    expect(evaluateBookingAge(null, 14).status).toBe("WARN");
  });
});
