import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendNewAppointmentEmail } from "@/lib/notifications/send-admin-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn(function (this: { emails: { send: typeof mockSend } }) {
    this.emails = { send: mockSend };
  }),
}));

describe("sendNewAppointmentEmail", () => {
  const baseInput = {
    clientName: "Test Klijent",
    clientPhone: "+38765000000",
    clientEmail: null,
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-15T16:00:00.000Z"),
    // 60 min kasnije — caller proslijedi addMinutes(start, service.duration_min);
    // za Šminkanje (60min) to je 17:00 UTC. Real-world Trepavice 1:1 bi imao
    // 180min duration → 19:00 UTC (vidi posebni test ispod).
    endTime: new Date("2026-05-15T17:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://upbeauty.ba/admin/termini",
    appointmentId: 42,
  };

  beforeEach(() => {
    mockSend.mockReset();
    _resetResendClientForTests();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "rezervacije@upbeauty.ba");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "una@example.com");
  });

  it("poziva Resend send sa pravim parametrima kada su env vars set", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendNewAppointmentEmail(baseInput);

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.from).toBe("rezervacije@upbeauty.ba");
    expect(args.to).toEqual(["una@example.com"]);
    expect(args.subject).toContain("Test Klijent");
    expect(args.html).toContain("Test Klijent");
    expect(args.text).toContain("Test Klijent");
  });

  it("ne baca error niti poziva Resend kada RESEND_API_KEY nije set", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    _resetResendClientForTests();

    await expect(sendNewAppointmentEmail(baseInput)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("ne baca error kada Resend API vrati error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Domain not verified", name: "validation_error" },
    });

    await expect(sendNewAppointmentEmail(baseInput)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("ne baca error kada Resend send throw-uje (network error)", async () => {
    mockSend.mockRejectedValue(new Error("Network timeout"));

    await expect(sendNewAppointmentEmail(baseInput)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("uključuje .ics attachment u Resend payload sa realnim trajanjem usluge", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_456" }, error: null });

    // Trepavice 1:1 = 180min → start 18:00 Sarajevo (16:00 UTC), end 21:00 (19:00 UTC).
    // Ovo je glavni regression case za bug "fixed 60min duration".
    await sendNewAppointmentEmail({
      ...baseInput,
      serviceName: "Trepavice 1:1",
      startTime: new Date("2026-05-28T16:00:00.000Z"),
      endTime: new Date("2026-05-28T19:00:00.000Z"),
    });

    const args = mockSend.mock.calls[0][0];
    expect(args.attachments).toHaveLength(1);
    expect(args.attachments[0].filename).toBe("rezervacija.ics");

    // Base64 → utf-8 → mora sadržati VCALENDAR header + real DTSTART/DTEND
    const decoded = Buffer.from(args.attachments[0].content, "base64").toString("utf-8");
    expect(decoded).toContain("BEGIN:VCALENDAR");
    expect(decoded).toContain("DTSTART:20260528T160000Z");
    // Bug check: DTEND mora biti +180min (19:00 UTC), NE +60min (17:00 UTC)
    expect(decoded).toContain("DTEND:20260528T190000Z");
  });
});
