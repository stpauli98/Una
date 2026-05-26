import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendBookingReceivedEmail } from "@/lib/notifications/send-booking-received-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const baseInput = {
  clientName: "Test", clientPhone: "+387 65 000 000",
  clientEmail: "test@example.com", serviceName: "Šminkanje",
  startTime: new Date("2026-05-28T16:00:00.000Z"),
  endTime: new Date("2026-05-28T17:00:00.000Z"),
  notes: null, adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
};

describe("sendBookingReceivedEmail", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { _resetResendClientForTests(); warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; });

  it("skip silently if no client email", async () => {
    await sendBookingReceivedEmail({ ...baseInput, clientEmail: null });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it("warns if RESEND_API_KEY missing", async () => {
    await sendBookingReceivedEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith("[booking-received email skipped] RESEND_API_KEY missing");
  });
  it("warns if RESEND_FROM_EMAIL missing", async () => {
    process.env.RESEND_API_KEY = "re_test";
    await sendBookingReceivedEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith("[booking-received email skipped] RESEND_FROM_EMAIL missing");
  });
});
