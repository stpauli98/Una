import { describe, it, expect } from "vitest";
import { renderNewAppointmentEmail } from "@/lib/notifications/templates";

describe("renderNewAppointmentEmail", () => {
  const baseInput = {
    clientName: "Marija Kovač",
    clientPhone: "+38765123456",
    clientEmail: "marija@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-15T16:00:00.000Z"), // 18:00 Sarajevo (CEST UTC+2)
    notes: "Alergija na lateks",
    adminPanelUrl: "https://upbeauty.ba/admin/termini",
  };

  it("subject sadrži ime klijenta, ime usluge i datum", () => {
    const result = renderNewAppointmentEmail(baseInput);
    expect(result.subject).toContain("Marija Kovač");
    expect(result.subject).toContain("Šminkanje");
    expect(result.subject).toMatch(/maj|svibanj/i); // BiH/HR mjesec
  });

  it("HTML body sadrži sva polja", () => {
    const { html } = renderNewAppointmentEmail(baseInput);
    expect(html).toContain("Marija Kovač");
    expect(html).toContain("+38765123456");
    expect(html).toContain("marija@example.com");
    expect(html).toContain("Šminkanje");
    expect(html).toContain("18:00"); // Sarajevo time
    expect(html).toContain("Alergija na lateks");
    expect(html).toContain("https://upbeauty.ba/admin/termini");
  });

  it("text body sadrži sva polja u plain text formatu", () => {
    const { text } = renderNewAppointmentEmail(baseInput);
    expect(text).toContain("Marija Kovač");
    expect(text).toContain("+38765123456");
    expect(text).toContain("Šminkanje");
    expect(text).toContain("18:00");
    expect(text).not.toContain("<"); // no HTML tags
  });

  it("bez email-a klijenta — HTML/text ne prikazuju email row", () => {
    const { html, text } = renderNewAppointmentEmail({
      ...baseInput,
      clientEmail: null,
    });
    expect(html).not.toContain("marija@example.com");
    expect(html).not.toContain("mailto:");
    expect(text).not.toMatch(/Email:/i);
  });

  it("bez napomene — HTML/text ne prikazuju napomena sekciju", () => {
    const { html, text } = renderNewAppointmentEmail({
      ...baseInput,
      notes: null,
    });
    expect(html).not.toContain("Alergija na lateks");
    expect(html).not.toMatch(/Napomena/i);
    expect(text).not.toMatch(/Napomena/i);
  });
});
