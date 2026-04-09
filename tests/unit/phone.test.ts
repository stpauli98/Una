import { describe, it, expect } from "vitest";
import { isValidPhone, normalizePhone } from "@/lib/utils/phone";

describe("normalizePhone — BA default", () => {
  it("handles 065... format → +387", () => {
    expect(normalizePhone("065810323")).toBe("+38765810323");
  });
  it("handles +387 with spaces", () => {
    expect(normalizePhone("+387 65 810 323")).toBe("+38765810323");
  });
  it("handles 00387 international prefix", () => {
    expect(normalizePhone("0038765810323")).toBe("+38765810323");
  });
  it("strips dashes, dots, parens", () => {
    expect(normalizePhone("(065) 810-323")).toBe("+38765810323");
  });
});

describe("normalizePhone — international numbers", () => {
  it("Germany +49", () => {
    expect(normalizePhone("+49 151 23456789")).toBe("+4915123456789");
  });
  it("Serbia +381", () => {
    expect(normalizePhone("+381 63 555 1234")).toBe("+381635551234");
  });
  it("Croatia +385", () => {
    expect(normalizePhone("+385 98 1234567")).toBe("+385981234567");
  });
  it("Montenegro +382", () => {
    expect(normalizePhone("+382 67 123 456")).toBe("+38267123456");
  });
  it("USA +1", () => {
    expect(normalizePhone("+1 212 555 0100")).toBe("+12125550100");
  });
});

describe("isValidPhone — BA mobile numbers", () => {
  it("accepts Telekom Srpske 065", () => {
    expect(isValidPhone("065810323")).toBe(true);
  });
  it("accepts m:tel 066", () => {
    expect(isValidPhone("066987654")).toBe(true);
  });
  it("accepts BH Telecom 061", () => {
    expect(isValidPhone("061234567")).toBe(true);
  });
  it("accepts HT Eronet 063", () => {
    expect(isValidPhone("063123456")).toBe(true);
  });
  it("accepts +387 prefixed", () => {
    expect(isValidPhone("+38765810323")).toBe(true);
  });
  it("accepts 00387 international prefixed", () => {
    expect(isValidPhone("0038765810323")).toBe(true);
  });
});

describe("isValidPhone — international mobile numbers", () => {
  it("accepts German mobile +49 151...", () => {
    expect(isValidPhone("+49 151 23456789")).toBe(true);
  });
  it("accepts Serbian mobile +381 63...", () => {
    expect(isValidPhone("+381 63 555 1234")).toBe(true);
  });
  it("accepts Croatian mobile +385 98...", () => {
    expect(isValidPhone("+385 98 1234567")).toBe(true);
  });
  it("accepts Austrian mobile +43 664...", () => {
    expect(isValidPhone("+43 664 1234567")).toBe(true);
  });
  it("accepts Montenegrin mobile +382 67...", () => {
    expect(isValidPhone("+382 67 123 456")).toBe(true);
  });
  it("accepts US number +1 212...", () => {
    expect(isValidPhone("+1 212 555 0100")).toBe(true);
  });
});

describe("isValidPhone — rejections", () => {
  it("rejects too short", () => {
    expect(isValidPhone("065123")).toBe(false);
  });
  it("rejects non-digits only", () => {
    expect(isValidPhone("abc")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });
  it("rejects nonsense country code", () => {
    expect(isValidPhone("+999 12345")).toBe(false);
  });
  it("rejects random digits without context", () => {
    expect(isValidPhone("12")).toBe(false);
  });
});
