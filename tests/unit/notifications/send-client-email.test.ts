import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendClientConfirmationEmail } from "@/lib/notifications/send-client-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const baseInput = {
  clientName: "Test Klijent",
  clientPhone: "+387 65 000 000",
  clientEmail: "test@example.com",
  serviceName: "Šminkanje",
  startTime: new Date("2026-05-28T16:00:00.000Z"),
  endTime: new Date("2026-05-28T17:00:00.000Z"),
  notes: null,
  adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
  appointmentId: 42,
};

describe("sendClientConfirmationEmail", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetResendClientForTests();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("skip-uje silently ako klijent nije ostavio email", async () => {
    await sendClientConfirmationEmail({ ...baseInput, clientEmail: null });
    // NE smije logovati skip (klijent bez email-a je expected case, ne anomalija)
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("loguje 'RESEND_API_KEY missing' ako klijent ima email ali server nije konfigurisan", async () => {
    await sendClientConfirmationEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith(
      "[client email skipped] RESEND_API_KEY missing",
    );
  });

  it("loguje 'RESEND_FROM_EMAIL missing' kad API key postoji ali FROM nedostaje", async () => {
    process.env.RESEND_API_KEY = "re_test";
    await sendClientConfirmationEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith(
      "[client email skipped] RESEND_FROM_EMAIL missing",
    );
  });
});
