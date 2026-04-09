import { describe, it, expect } from "vitest";
import {
  serviceSchema,
  ALLOWED_DURATIONS,
} from "@/lib/services/schema";

const VALID_BASE = {
  name: "Test usluga",
  description: null,
  price: 50,
  price_note: null,
  duration_min: 60,
  duration_note: null,
  category: "sminkanje" as const,
  bookable: true,
  variable_price: false,
  active: true,
};

describe("serviceSchema — duration_min validacija", () => {
  it.each(ALLOWED_DURATIONS)(
    "prihvata dozvoljenu vrijednost %s",
    (allowed) => {
      const result = serviceSchema.safeParse({
        ...VALID_BASE,
        duration_min: allowed,
      });
      expect(result.success).toBe(true);
    },
  );

  it("prihvata null (npr. obuka po danima)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: null,
    });
    expect(result.success).toBe(true);
  });

  it("odbija vrijednost koja nije multiple of 30 (npr. 22)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 22,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "duration_min",
      );
      expect(issue?.message).toContain("Trajanje");
    }
  });

  it("odbija 15 (multiple of 15 ali ne 30)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 15,
    });
    expect(result.success).toBe(false);
  });

  it("odbija 45 (multiple of 15 ali ne 30)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 45,
    });
    expect(result.success).toBe(false);
  });

  it("odbija 0 (van granica)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 0,
    });
    expect(result.success).toBe(false);
  });

  it("odbija negativnu vrijednost", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: -30,
    });
    expect(result.success).toBe(false);
  });

  it("odbija 270 (preko maksimuma 240)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 270,
    });
    expect(result.success).toBe(false);
  });

  it("odbija 300 (preko maksimuma 240)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 300,
    });
    expect(result.success).toBe(false);
  });

  it("odbija decimalnu vrijednost (60.5)", () => {
    const result = serviceSchema.safeParse({
      ...VALID_BASE,
      duration_min: 60.5,
    });
    expect(result.success).toBe(false);
  });
});

describe("ALLOWED_DURATIONS", () => {
  it("počinje sa 30 i završava sa 240", () => {
    expect(ALLOWED_DURATIONS[0]).toBe(30);
    expect(ALLOWED_DURATIONS[ALLOWED_DURATIONS.length - 1]).toBe(240);
  });

  it("svaki element je multiple od 30", () => {
    for (const d of ALLOWED_DURATIONS) {
      expect(d % 30).toBe(0);
    }
  });

  it("ima 8 vrijednosti (30, 60, ..., 240)", () => {
    expect(ALLOWED_DURATIONS).toHaveLength(8);
  });
});
