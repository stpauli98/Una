import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatDuration,
  formatDate,
  formatTime,
  formatDateTime,
} from "@/lib/utils/format";

describe("formatPrice", () => {
  it("appends KM to numeric price", () => {
    expect(formatPrice(70)).toBe("70 KM");
  });
  it("handles decimals", () => {
    expect(formatPrice(70.5)).toBe("70,50 KM");
  });
  it("returns preset string unchanged", () => {
    expect(formatPrice("od 150 KM")).toBe("od 150 KM");
  });
});

describe("formatDuration", () => {
  it("60 min → 1h", () => {
    expect(formatDuration(60)).toBe("1h");
  });
  it("120 min → 2h", () => {
    expect(formatDuration(120)).toBe("2h");
  });
  it("180 min → 3h", () => {
    expect(formatDuration(180)).toBe("3h");
  });
  it("90 min → 1h 30min", () => {
    expect(formatDuration(90)).toBe("1h 30min");
  });
  it("45 min → 45min", () => {
    expect(formatDuration(45)).toBe("45min");
  });
  it("null → —", () => {
    expect(formatDuration(null)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats in Serbian latin", () => {
    const d = new Date("2026-04-15T12:00:00");
    const out = formatDate(d);
    // srijeda, 15. april
    expect(out.toLowerCase()).toContain("srijeda");
    expect(out).toContain("15");
    expect(out.toLowerCase()).toContain("april");
  });
});

describe("formatTime", () => {
  it("HH:mm", () => {
    const d = new Date(2026, 3, 15, 17, 30);
    expect(formatTime(d)).toBe("17:30");
  });
  it("pads single-digit hour", () => {
    const d = new Date(2026, 3, 15, 9, 5);
    expect(formatTime(d)).toBe("09:05");
  });
});

describe("formatDateTime", () => {
  it("combines date and time", () => {
    const d = new Date(2026, 3, 15, 17, 30);
    const out = formatDateTime(d);
    expect(out).toContain("17:30");
    expect(out).toContain("15");
  });
});
