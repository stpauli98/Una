import { describe, it, expect } from "vitest";
import { countByStatus, type AppointmentStatus } from "@/lib/utils/status-counts";

type Appt = { status: string };

describe("countByStatus", () => {
  it("returns zeros for empty input", () => {
    const result = countByStatus<Appt>([]);
    expect(result).toEqual({
      ceka: 0,
      potvrdjen: 0,
      otkazan: 0,
      zavrsen: 0,
    });
  });

  it("counts a single appointment correctly", () => {
    const result = countByStatus<Appt>([{ status: "ceka" }]);
    expect(result.ceka).toBe(1);
    expect(result.potvrdjen).toBe(0);
  });

  it("counts multiple appointments across statuses", () => {
    const result = countByStatus<Appt>([
      { status: "ceka" },
      { status: "ceka" },
      { status: "potvrdjen" },
      { status: "zavrsen" },
      { status: "otkazan" },
      { status: "otkazan" },
    ]);
    expect(result).toEqual({
      ceka: 2,
      potvrdjen: 1,
      otkazan: 2,
      zavrsen: 1,
    });
  });

  it("ignores unknown status values", () => {
    const result = countByStatus<Appt>([
      { status: "ceka" },
      { status: "UNKNOWN_STATUS" },
      { status: "potvrdjen" },
    ]);
    expect(result).toEqual({
      ceka: 1,
      potvrdjen: 1,
      otkazan: 0,
      zavrsen: 0,
    });
  });

  it("type AppointmentStatus is the union of valid statuses", () => {
    // Compile-time check: assign valid values
    const a: AppointmentStatus = "ceka";
    const b: AppointmentStatus = "potvrdjen";
    const c: AppointmentStatus = "otkazan";
    const d: AppointmentStatus = "zavrsen";
    expect([a, b, c, d]).toHaveLength(4);
  });
});
