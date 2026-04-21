import { describe, it, expect } from "vitest";
import {
  bookingFormSchema,
  manualAppointmentSchema,
} from "@/lib/booking/schemas";

describe("bookingFormSchema", () => {
  const valid = {
    service_id: 1,
    start_time: "2026-05-01T17:00:00.000Z",
    client_name: "Ana Petrović",
    client_phone: "065123456",
    client_email: "",
    consent: true as const,
  };

  it("accepts valid booking", () => {
    expect(bookingFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing consent", () => {
    const r = bookingFormSchema.safeParse({ ...valid, consent: undefined });
    expect(r.success).toBe(false);
  });

  it("rejects consent=false", () => {
    const r = bookingFormSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });

  it("rejects name shorter than 2 chars", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_name: "A" });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      client_name: "A".repeat(101),
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid phone", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_phone: "123" });
    expect(r.success).toBe(false);
  });

  it("accepts BA phone 065", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      client_phone: "065123456",
    });
    expect(r.success).toBe(true);
  });

  it("accepts international phone +49", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      client_phone: "+4915123456789",
    });
    expect(r.success).toBe(true);
  });

  it("rejects negative service_id", () => {
    const r = bookingFormSchema.safeParse({ ...valid, service_id: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer service_id", () => {
    const r = bookingFormSchema.safeParse({ ...valid, service_id: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rejects invalid start_time format", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      start_time: "not-a-date",
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid email", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      client_email: "a@b.com",
    });
    expect(r.success).toBe(true);
  });

  it("accepts empty email", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_email: "" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      client_email: "notanemail",
    });
    expect(r.success).toBe(false);
  });

  it("rejects notes longer than 500 chars", () => {
    const r = bookingFormSchema.safeParse({
      ...valid,
      notes: "X".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe("manualAppointmentSchema", () => {
  const valid = {
    service_id: 1,
    start_time: "2026-05-01T17:00:00.000Z",
    client_name: "Admin Test",
    client_phone: "065999888",
  };

  it("accepts valid manual booking (no consent needed)", () => {
    expect(manualAppointmentSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts force=true", () => {
    const r = manualAppointmentSchema.safeParse({ ...valid, force: true });
    expect(r.success).toBe(true);
  });

  it("accepts force=false", () => {
    const r = manualAppointmentSchema.safeParse({ ...valid, force: false });
    expect(r.success).toBe(true);
  });

  it("does not require consent field", () => {
    const r = manualAppointmentSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
});
