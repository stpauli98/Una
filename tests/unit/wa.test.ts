import { describe, it, expect } from "vitest";
import { waLink } from "@/lib/utils/wa";

describe("waLink — BA local phones", () => {
  it("strips leading zero and prefixes 387", () => {
    expect(waLink("065810323", "Zdravo")).toBe(
      "https://wa.me/38765810323?text=Zdravo",
    );
  });

  it("handles +387 prefix with spaces", () => {
    expect(waLink("+387 65 810 323", "Hi")).toBe(
      "https://wa.me/38765810323?text=Hi",
    );
  });

  it("handles 00387 international prefix", () => {
    expect(waLink("0038765810323", "Hi")).toBe(
      "https://wa.me/38765810323?text=Hi",
    );
  });

  it("handles dashes and dots", () => {
    expect(waLink("065-810.323", "ok")).toBe(
      "https://wa.me/38765810323?text=ok",
    );
  });
});

describe("waLink — international phones", () => {
  it("German +49", () => {
    expect(waLink("+49 151 23456789", "Hi Una")).toBe(
      "https://wa.me/4915123456789?text=Hi%20Una",
    );
  });

  it("Serbian +381", () => {
    expect(waLink("+381 63 555 1234", "Pozdrav")).toBe(
      "https://wa.me/381635551234?text=Pozdrav",
    );
  });

  it("Croatian +385", () => {
    expect(waLink("+385 98 1234567", "Bok")).toBe(
      "https://wa.me/385981234567?text=Bok",
    );
  });

  it("US +1", () => {
    expect(waLink("+1 212 555 0100", "Hi")).toBe(
      "https://wa.me/12125550100?text=Hi",
    );
  });
});

describe("waLink — message encoding", () => {
  it("url-encodes Serbian diacritics and special chars", () => {
    expect(waLink("065810323", "Termin za Šminkanje 17:00")).toBe(
      "https://wa.me/38765810323?text=Termin%20za%20%C5%A0minkanje%2017%3A00",
    );
  });

  it("encodes newlines", () => {
    expect(waLink("065810323", "linija 1\nlinija 2")).toBe(
      "https://wa.me/38765810323?text=linija%201%0Alinija%202",
    );
  });
});
