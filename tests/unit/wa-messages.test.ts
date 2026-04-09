import { describe, it, expect } from "vitest";
import {
  buildAppointmentWaMessage,
  waButtonLabel,
} from "@/lib/utils/wa-messages";

const BASE = {
  clientName: "Marija Testić",
  serviceName: "Šminkanje",
  startTime: new Date(2026, 3, 20, 17, 0), // 20. april 2026, 17:00
};

describe("buildAppointmentWaMessage", () => {
  it("ceka → poruka potvrde termina", () => {
    const msg = buildAppointmentWaMessage({ ...BASE, status: "ceka" });
    expect(msg).toContain("Potvrđujem vaš termin");
    expect(msg).toContain("Šminkanje");
    expect(msg).toContain("17:00");
    expect(msg).toContain("Marija"); // only first name
    expect(msg).not.toContain("otkazati");
  });

  it("potvrdjen → poruka potvrde termina (isto kao ceka)", () => {
    const msg = buildAppointmentWaMessage({ ...BASE, status: "potvrdjen" });
    expect(msg).toContain("Potvrđujem vaš termin");
  });

  it("otkazan → poruka o otkazivanju sa izvinjenjem", () => {
    const msg = buildAppointmentWaMessage({ ...BASE, status: "otkazan" });
    expect(msg).toContain("moram otkazati");
    expect(msg).toContain("Izvinjavam se");
    expect(msg).toContain("novi termin");
    expect(msg).toContain("Šminkanje");
    expect(msg).toContain("17:00");
    expect(msg).not.toContain("Potvrđujem");
  });

  it("zavrsen → zahvalnica", () => {
    const msg = buildAppointmentWaMessage({ ...BASE, status: "zavrsen" });
    expect(msg).toContain("hvala");
    expect(msg).toContain("Vidimo se");
    expect(msg).not.toContain("Potvrđujem");
    expect(msg).not.toContain("otkazati");
  });

  it("koristi samo prvo ime iz punog imena", () => {
    const msg = buildAppointmentWaMessage({
      ...BASE,
      clientName: "Marija Ana Petrović",
      status: "otkazan",
    });
    expect(msg).toContain("Zdravo Marija,");
    expect(msg).not.toContain("Marija Ana");
  });
});

describe("waButtonLabel", () => {
  it("otkazan → 'WhatsApp otkaz'", () => {
    expect(waButtonLabel("otkazan")).toBe("WhatsApp otkaz");
  });
  it("zavrsen → 'WhatsApp hvala'", () => {
    expect(waButtonLabel("zavrsen")).toBe("WhatsApp hvala");
  });
  it("ceka → 'WhatsApp potvrda'", () => {
    expect(waButtonLabel("ceka")).toBe("WhatsApp potvrda");
  });
  it("potvrdjen → 'WhatsApp potvrda'", () => {
    expect(waButtonLabel("potvrdjen")).toBe("WhatsApp potvrda");
  });
});
