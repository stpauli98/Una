import { describe, it, expect } from "vitest";
import { buildIcsContent } from "@/lib/notifications/ics";

describe("buildIcsContent", () => {
  const baseInput = {
    uid: "appt-42@upmakeup.ba",
    start: new Date("2026-05-28T16:00:00.000Z"), // 18:00 Sarajevo CEST
    end: new Date("2026-05-28T17:00:00.000Z"), // 19:00 Sarajevo CEST
    summary: "Šminkanje sa Unom",
    location: "Majora Milana Tepića 13, Gradiška",
    description: "Termin za Test Klijent. Kontakt: +387 65 810 323.",
    organizerName: "UP Makeup",
    organizerEmail: "rezervacije@upmakeup.ba",
  };

  it("vraća validan VCALENDAR sa VEVENT blokom", () => {
    const ics = buildIcsContent(baseInput);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR$/);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
  });

  it("koristi CRLF line endings (RFC 5545)", () => {
    const ics = buildIcsContent(baseInput);
    // ICS spec zahtjeva CRLF, ne samo LF
    expect(ics.includes("\r\n")).toBe(true);
    // Niti jedan plain LF bez prethodnog CR
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(line.includes("\n")).toBe(false);
    }
  });

  it("emituje DTSTART i DTEND u UTC sa Z suffix-om", () => {
    const ics = buildIcsContent(baseInput);
    expect(ics).toContain("DTSTART:20260528T160000Z");
    expect(ics).toContain("DTEND:20260528T170000Z");
  });

  it("escape-uje zarez, semicolon i newline u tekstualnim poljima", () => {
    const ics = buildIcsContent({
      ...baseInput,
      location: "Adresa, 13; Gradiška",
      description: "Linija 1\nLinija 2",
      summary: 'Šminkanje "VIP"',
    });
    expect(ics).toContain("LOCATION:Adresa\\, 13\\; Gradiška");
    expect(ics).toContain("DESCRIPTION:Linija 1\\nLinija 2");
    // Navodnici se NE escape-uju u ICS-u (samo \, ;, newline)
    expect(ics).toContain('SUMMARY:Šminkanje "VIP"');
  });

  it("sadrži UID i ORGANIZER ako su prosljeđeni", () => {
    const ics = buildIcsContent(baseInput);
    expect(ics).toContain("UID:appt-42@upmakeup.ba");
    expect(ics).toContain("ORGANIZER;CN=UP Makeup:mailto:rezervacije@upmakeup.ba");
  });

  it("organizer je opcioni — preskače blok ako nije prosljeđen", () => {
    const ics = buildIcsContent({
      ...baseInput,
      organizerName: undefined,
      organizerEmail: undefined,
    });
    expect(ics).not.toContain("ORGANIZER");
  });
});
