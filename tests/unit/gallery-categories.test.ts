import { describe, it, expect } from "vitest";
import {
  isValidGalleryCategory,
  slugifyCategory,
} from "@/lib/gallery/categories";

describe("isValidGalleryCategory", () => {
  const keys = ["sminkanje", "obuka", "pedikir"];

  it("prihvata key iz prosljeđene liste", () => {
    expect(isValidGalleryCategory("sminkanje", keys)).toBe(true);
    expect(isValidGalleryCategory("obuka", keys)).toBe(true);
  });

  it("odbija nepoznate i prazan string", () => {
    expect(isValidGalleryCategory("foo", keys)).toBe(false);
    expect(isValidGalleryCategory("", keys)).toBe(false);
    expect(isValidGalleryCategory("Šminkanje", keys)).toBe(false); // case sensitive
  });

  it("odbija sve kad je lista prazna", () => {
    expect(isValidGalleryCategory("sminkanje", [])).toBe(false);
  });
});

describe("slugifyCategory", () => {
  it("lowercases ASCII", () => {
    expect(slugifyCategory("Pedikir")).toBe("pedikir");
  });
  it("strips Serbian diacritics", () => {
    expect(slugifyCategory("Šminkanje")).toBe("sminkanje");
    expect(slugifyCategory("Đođ")).toBe("djodj");
    expect(slugifyCategory("Čačać")).toBe("cacac");
    expect(slugifyCategory("Žaba")).toBe("zaba");
  });
  it("replaces spaces and non-alphanumerics with hyphen", () => {
    expect(slugifyCategory("Spa pedikir")).toBe("spa-pedikir");
    expect(slugifyCategory("Nokti & gel")).toBe("nokti-gel");
  });
  it("trims leading/trailing hyphens and collapses repeats", () => {
    expect(slugifyCategory("  Mladenke!  ")).toBe("mladenke");
    expect(slugifyCategory("a---b")).toBe("a-b");
  });
  it("returns empty string for input with no usable chars", () => {
    expect(slugifyCategory("!!!")).toBe("");
  });
});
