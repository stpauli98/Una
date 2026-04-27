import { describe, it, expect } from "vitest";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/auth/admin-emails";

describe("admin-emails", () => {
  it("contains the production admin", () => {
    expect(ADMIN_EMAILS.has("peranovicuna6@gmail.com")).toBe(true);
  });

  it("isAdminEmail accepts a known admin", () => {
    expect(isAdminEmail("peranovicuna6@gmail.com")).toBe(true);
  });

  it("isAdminEmail rejects a random email", () => {
    expect(isAdminEmail("attacker@evil.com")).toBe(false);
  });

  it("isAdminEmail rejects undefined and empty string", () => {
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null as unknown as string)).toBe(false);
  });

  it("test admin user is only present when ADMIN_EMAILS_EXTRA env var is set", () => {
    if (!process.env.ADMIN_EMAILS_EXTRA) {
      expect(ADMIN_EMAILS.has("test@admin.com")).toBe(false);
    }
  });
});
