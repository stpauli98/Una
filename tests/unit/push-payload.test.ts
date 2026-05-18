import { describe, it, expect } from "vitest";
import { buildNewAppointmentPayload } from "@/lib/push/send";

describe("buildNewAppointmentPayload", () => {
  it("includes client name and service name in body", () => {
    const payload = buildNewAppointmentPayload({
      clientName: "Marko Marković",
      serviceName: "Šminkanje",
      startTime: new Date("2026-05-19T14:30:00+02:00"),
    });
    expect(payload.title).toBe("Nova rezervacija");
    expect(payload.body).toContain("Marko Marković");
    expect(payload.body).toContain("Šminkanje");
    expect(payload.url).toBe("/admin/termini");
  });

  it("formats time in Sarajevo locale", () => {
    const payload = buildNewAppointmentPayload({
      clientName: "Ana A.",
      serviceName: "Manikir",
      startTime: new Date("2026-05-19T14:30:00+02:00"),
    });
    expect(payload.body).toMatch(/14:30|14.30/);
  });
});
