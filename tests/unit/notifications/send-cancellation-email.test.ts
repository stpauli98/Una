import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendCancellationEmail } from "@/lib/notifications/send-cancellation-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const baseInput = {
  clientName: "Test", clientPhone: "+387 65 000 000",
  clientEmail: "test@example.com", serviceName: "Šminkanje",
  startTime: new Date("2026-05-28T16:00:00.000Z"),
  endTime: new Date("2026-05-28T17:00:00.000Z"),
  notes: null, adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
};

describe("sendCancellationEmail", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { _resetResendClientForTests(); warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; });

  it("skip silently if no client email", async () => {
    await sendCancellationEmail({ ...baseInput, clientEmail: null, previousStatus: "ceka" });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it("warns if RESEND_API_KEY missing (ceka scenario)", async () => {
    await sendCancellationEmail({ ...baseInput, previousStatus: "ceka" });
    expect(warnSpy).toHaveBeenCalledWith("[cancellation email skipped] RESEND_API_KEY missing");
  });
  it("warns if RESEND_API_KEY missing (potvrdjen scenario)", async () => {
    await sendCancellationEmail({ ...baseInput, previousStatus: "potvrdjen" });
    expect(warnSpy).toHaveBeenCalledWith("[cancellation email skipped] RESEND_API_KEY missing");
  });
});
