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
    notes: null,
    adminPanelUrl: "https://upbeauty.ba/admin/termini",
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
});
