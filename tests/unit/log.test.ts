import { describe, it, expect } from "vitest";
import { sanitizeError } from "@/lib/utils/log";

describe("sanitizeError", () => {
  it("returns code and short message for Postgres errors", () => {
    const pgErr = {
      code: "23505",
      message: "duplicate key value violates unique constraint \"appointments_pkey\"",
      details: "Key (client_phone)=(+38765123456) already exists.",
      hint: null,
    };
    const out = sanitizeError(pgErr);
    expect(out.code).toBe("23505");
    expect(out.message).toBe("duplicate key value violates unique constraint");
    expect(JSON.stringify(out)).not.toContain("38765");
    expect(JSON.stringify(out)).not.toContain("client_phone");
  });

  it("truncates message to 80 chars", () => {
    const err = { message: "a".repeat(500) };
    expect(sanitizeError(err).message?.length).toBeLessThanOrEqual(80);
  });

  it("handles plain Error objects", () => {
    const err = new Error("network failure");
    const out = sanitizeError(err);
    expect(out.message).toBe("network failure");
    expect(out.code).toBeUndefined();
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeError(null)).toEqual({ code: undefined, message: "unknown error" });
    expect(sanitizeError(undefined)).toEqual({ code: undefined, message: "unknown error" });
  });

  it("strips email-shaped strings from the message", () => {
    const err = { message: "Insert failed for user@example.com on row 5" };
    expect(sanitizeError(err).message).not.toContain("@example.com");
  });

  it("strips phone-shaped strings from the message", () => {
    const err = { message: "Number +38765123456 is invalid" };
    const out = sanitizeError(err);
    expect(out.message).not.toContain("38765");
  });

  it("strips slash-formatted phone (Bosnian local format)", () => {
    const err = { message: "Number 065/123-456 is invalid" };
    const out = sanitizeError(err);
    expect(out.message).not.toContain("065");
    expect(out.message).not.toContain("123-456");
  });

  it("strips space-separated phone format", () => {
    const err = { message: "Phone 38 765 123 456 invalid" };
    const out = sanitizeError(err);
    expect(out.message).not.toContain("38 765");
  });

  it("strips trailing quoted identifier from Postgres messages", () => {
    const err = {
      message: 'duplicate key value violates unique constraint "appointments_pkey"',
    };
    expect(sanitizeError(err).message).toBe(
      "duplicate key value violates unique constraint",
    );
  });
});
