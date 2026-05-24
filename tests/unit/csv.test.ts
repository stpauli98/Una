import { describe, it, expect } from "vitest";
import { csvEscape, buildCsvRow } from "@/lib/utils/csv";

describe("csvEscape", () => {
  it("vraća string nepromijenjen ako nema specijalnih karaktera", () => {
    expect(csvEscape("Una Peranović")).toBe("Una Peranović");
    expect(csvEscape("12345")).toBe("12345");
    expect(csvEscape("")).toBe("");
  });

  it("escape-uje semicolon (EU CSV separator) — wrappa u navodnike", () => {
    expect(csvEscape("Pedikir; trepavice")).toBe('"Pedikir; trepavice"');
  });

  it("escape-uje navodnik dupliranjem unutar wrap-a", () => {
    expect(csvEscape('Klijent "VIP"')).toBe('"Klijent ""VIP"""');
  });

  it("escape-uje newline (CR/LF/CRLF) wrap-om", () => {
    expect(csvEscape("Linija 1\nLinija 2")).toBe('"Linija 1\nLinija 2"');
    expect(csvEscape("Linija 1\r\nLinija 2")).toBe('"Linija 1\r\nLinija 2"');
  });

  it("kombinuje sve — semicolon + navodnik + newline u jednom string-u", () => {
    expect(csvEscape('A; "B"\nC')).toBe('"A; ""B""\nC"');
  });

  it("number i undefined se konvertuju u string", () => {
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(0)).toBe("0");
    expect(csvEscape(undefined)).toBe("");
    expect(csvEscape(null)).toBe("");
  });
});

describe("buildCsvRow", () => {
  it("spaja kolone sa semicolon separator-om", () => {
    expect(buildCsvRow(["a", "b", "c"])).toBe("a;b;c");
  });

  it("escape-uje pojedinačne kolone prije spajanja", () => {
    expect(buildCsvRow(["normal", "ima; semi", 'sa "nav"'])).toBe(
      'normal;"ima; semi";"sa ""nav"""',
    );
  });

  it("podržava null/undefined kolone kao prazne", () => {
    expect(buildCsvRow(["a", null, undefined, "d"])).toBe("a;;;d");
  });
});
