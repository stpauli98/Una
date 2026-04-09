import { describe, it, expect } from "vitest";
import { waLink } from "@/lib/utils/wa";

describe("waLink", () => {
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

  it("url-encodes the message (Serbian diacritics and special chars)", () => {
    expect(waLink("065810323", "Termin za Šminkanje 17:00"))
      .toBe(
        "https://wa.me/38765810323?text=Termin%20za%20%C5%A0minkanje%2017%3A00",
      );
  });

  it("handles dashes and dots in phone", () => {
    expect(waLink("065-810.323", "ok")).toBe(
      "https://wa.me/38765810323?text=ok",
    );
  });

  it("encodes newlines", () => {
    expect(waLink("065810323", "linija 1\nlinija 2")).toBe(
      "https://wa.me/38765810323?text=linija%201%0Alinija%202",
    );
  });
});
