import { describe, it, expect } from "vitest";
import {
  renderNewAppointmentEmail,
  renderClientConfirmationEmail,
  renderBookingReceivedEmail,
  renderBookingNotConfirmedEmail,
  renderBookingCancelledEmail,
  type NewAppointmentEmailInput,
} from "@/lib/notifications/templates";

describe("renderNewAppointmentEmail", () => {
  const baseInput = {
    clientName: "Marija Kovač",
    clientPhone: "+38765123456",
    clientEmail: "marija@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-15T16:00:00.000Z"), // 18:00 Sarajevo (CEST UTC+2)
    endTime: new Date("2026-05-15T17:00:00.000Z"), // 19:00 Sarajevo, 60min Šminkanje
    notes: "Alergija na lateks",
    adminPanelUrl: "https://upbeauty.ba/admin/termini",
    appointmentId: 42,
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

describe("renderClientConfirmationEmail", () => {
  const clientInput: NewAppointmentEmailInput = {
    clientName: "Marko Marković",
    clientPhone: "+387 65 000 000",
    clientEmail: "marko@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-28T16:00:00.000Z"), // 18:00 Sarajevo CEST
    endTime: new Date("2026-05-28T17:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
    appointmentId: 42,
  };

  it("subject sadrži uslugu, datum i vrijeme u Sarajevo TZ", () => {
    const { subject } = renderClientConfirmationEmail(clientInput);
    expect(subject).toContain("Šminkanje");
    expect(subject).toContain("18:00");
    expect(subject).toMatch(/maj 2026/);
  });

  it("HTML escape-uje korisničke karaktere", () => {
    const { html } = renderClientConfirmationEmail({
      ...clientInput,
      clientName: 'Marko "&" Petrović',
    });
    expect(html).toContain("&quot;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain('"&"');
  });

  it("text body je confirmation ton (potvrđen, ne 'Nova rezervacija')", () => {
    const { text } = renderClientConfirmationEmail(clientInput);
    expect(text).toContain("potvrđen");
    expect(text).toContain("potvrdila");
    expect(text).not.toContain("Nova rezervacija");
    expect(text).not.toContain("Una će potvrditi");
  });
});

describe("renderBookingReceivedEmail", () => {
  const clientInput: NewAppointmentEmailInput = {
    clientName: "Marko Marković",
    clientPhone: "+387 65 000 000",
    clientEmail: "marko@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-28T16:00:00.000Z"),
    endTime: new Date("2026-05-28T17:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
    appointmentId: 42,
  };

  it("subject sadrži uslugu i datum bez vremena", () => {
    const { subject } = renderBookingReceivedEmail(clientInput);
    expect(subject).toContain("Primili smo");
    expect(subject).toContain("Šminkanje");
  });

  it("body ne sadrži .ics referencu", () => {
    const { text } = renderBookingReceivedEmail(clientInput);
    expect(text).not.toContain(".ics");
    expect(text).toContain("Kad potvrdi");
  });
});

describe("renderBookingNotConfirmedEmail", () => {
  const clientInput: NewAppointmentEmailInput = {
    clientName: "Marko Marković",
    clientPhone: "+387 65 000 000",
    clientEmail: "marko@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-28T16:00:00.000Z"),
    endTime: new Date("2026-05-28T17:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
    appointmentId: 42,
  };

  it("subject sadrži 'nije potvrđen'", () => {
    const { subject } = renderBookingNotConfirmedEmail(clientInput);
    expect(subject).toContain("nije potvrđen");
  });

  it("body sadrži rebook CTA", () => {
    const { text } = renderBookingNotConfirmedEmail(clientInput);
    expect(text).toContain("upmakeup.ba/zakazi");
    expect(text).toContain("+387 65 810 323");
  });
});

describe("renderBookingCancelledEmail", () => {
  const clientInput: NewAppointmentEmailInput = {
    clientName: "Marko Marković",
    clientPhone: "+387 65 000 000",
    clientEmail: "marko@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-28T16:00:00.000Z"),
    endTime: new Date("2026-05-28T17:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
    appointmentId: 42,
  };

  it("subject sadrži 'otkazan'", () => {
    const { subject } = renderBookingCancelledEmail(clientInput);
    expect(subject).toContain("otkazan");
  });

  it("body pominje .ics za brisanje iz kalendara", () => {
    const { text } = renderBookingCancelledEmail(clientInput);
    expect(text).toContain(".ics");
    expect(text).toContain("briše događaj");
  });
});

describe("renderClientConfirmationEmail — updated subject", () => {
  const clientInput: NewAppointmentEmailInput = {
    clientName: "Marko Marković",
    clientPhone: "+387 65 000 000",
    clientEmail: "marko@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-28T16:00:00.000Z"),
    endTime: new Date("2026-05-28T17:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
    appointmentId: 42,
  };

  it("subject počinje sa 'Una je potvrdila'", () => {
    const { subject } = renderClientConfirmationEmail(clientInput);
    expect(subject).toMatch(/^Una je potvrdila/);
  });
});
