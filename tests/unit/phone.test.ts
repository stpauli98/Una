import { describe, it, expect } from "vitest";
import { isValidBaPhone, normalizeBaPhone } from "@/lib/utils/phone";

describe("normalizeBaPhone", () => {
  it("handles 065... format", () => {
    expect(normalizeBaPhone("065810323")).toBe("+38765810323");
  });
  it("handles +387 with spaces", () => {
    expect(normalizeBaPhone("+387 65 810 323")).toBe("+38765810323");
  });
  it("handles 00387 international prefix", () => {
    expect(normalizeBaPhone("0038765810323")).toBe("+38765810323");
  });
  it("strips dashes, dots, parens", () => {
    expect(normalizeBaPhone("(065) 810-323")).toBe("+38765810323");
  });
});

describe("isValidBaPhone", () => {
  it("accepts Telekom Srpske 065", () => {
    expect(isValidBaPhone("065810323")).toBe(true);
  });
  it("accepts m:tel 066", () => {
    expect(isValidBaPhone("066987654")).toBe(true);
  });
  it("accepts BH Telecom 061", () => {
    expect(isValidBaPhone("061234567")).toBe(true);
  });
  it("accepts HT Eronet 063", () => {
    expect(isValidBaPhone("063123456")).toBe(true);
  });
  it("accepts +387 prefixed", () => {
    expect(isValidBaPhone("+38765810323")).toBe(true);
  });
  it("accepts 00387 international prefixed", () => {
    expect(isValidBaPhone("0038765810323")).toBe(true);
  });
  it("rejects too short", () => {
    expect(isValidBaPhone("065123")).toBe(false);
  });
  it("rejects too long", () => {
    expect(isValidBaPhone("0658103231234")).toBe(false);
  });
  it("rejects non-digits", () => {
    expect(isValidBaPhone("abc")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidBaPhone("")).toBe(false);
  });
  it("rejects landline 051", () => {
    expect(isValidBaPhone("051123456")).toBe(false);
  });
  it("rejects random foreign number", () => {
    expect(isValidBaPhone("+15551234567")).toBe(false);
  });
});
