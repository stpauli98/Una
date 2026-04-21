import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "@/lib/utils/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const ip = `test-under-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(ip, 5, 60000)).toBe(true);
    }
  });

  it("blocks request over the limit", () => {
    const ip = `test-over-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, 5, 60000);
    }
    expect(checkRateLimit(ip, 5, 60000)).toBe(false);
  });

  it("tracks IPs independently", () => {
    const ts = Date.now();
    const ipA = `test-a-${ts}`;
    const ipB = `test-b-${ts}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ipA, 5, 60000);
    }
    // ipA is at limit, ipB should still be allowed
    expect(checkRateLimit(ipA, 5, 60000)).toBe(false);
    expect(checkRateLimit(ipB, 5, 60000)).toBe(true);
  });

  it("resets after window expires", async () => {
    const ip = `test-reset-${Date.now()}`;
    // Use a tiny window (1ms)
    for (let i = 0; i < 3; i++) {
      checkRateLimit(ip, 3, 1);
    }
    expect(checkRateLimit(ip, 3, 1)).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 10));
    expect(checkRateLimit(ip, 3, 1)).toBe(true);
  });

  it("uses default limit of 10 when not specified", () => {
    const ip = `test-default-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    expect(checkRateLimit(ip)).toBe(false);
  });
});
