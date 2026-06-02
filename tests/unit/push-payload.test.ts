import { describe, it, expect } from "vitest";
import { buildNewAppointmentPayload } from "@/lib/push/send";

describe("buildNewAppointmentPayload", () => {
  it("includes client + service in body and deep-links to the exact appointment", () => {
    const payload = buildNewAppointmentPayload({
      id: 42,
      clientName: "Marko Marković",
      serviceName: "Šminkanje",
      startTime: new Date("2026-05-19T14:30:00+02:00"),
    });
    expect(payload.title).toBe("Nova rezervacija");
    expect(payload.body).toContain("Marko Marković");
    expect(payload.body).toContain("Šminkanje");
    // Deep-link kao u email-u: vodi na tačan datum + fokusira taj termin.
    expect(payload.url).toBe("/admin/termini?date=2026-05-19&focus=42");
  });

  it("formats time in Sarajevo locale", () => {
    const payload = buildNewAppointmentPayload({
      id: 1,
      clientName: "Ana A.",
      serviceName: "Manikir",
      startTime: new Date("2026-05-19T14:30:00+02:00"),
    });
    expect(payload.body).toMatch(/14:30|14.30/);
  });
});
