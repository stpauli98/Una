import { describe, it, expect } from "vitest";
import {
  GALLERY_CATEGORIES,
  GALLERY_CATEGORY_KEYS,
  isValidGalleryCategory,
  slugifyCategory,
  type GalleryCategory,
} from "@/lib/gallery/categories";

describe("GALLERY_CATEGORIES", () => {
  it("nije prazno", () => {
    expect(GALLERY_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("svaka stavka ima key i label", () => {
    for (const cat of GALLERY_CATEGORIES) {
      expect(typeof cat.key).toBe("string");
      expect(cat.key.length).toBeGreaterThan(0);
      expect(typeof cat.label).toBe("string");
      expect(cat.label.length).toBeGreaterThan(0);
    }
  });

  it("svi key-jevi su lowercase ASCII (sigurni za URL i filename)", () => {
    for (const cat of GALLERY_CATEGORIES) {
      expect(cat.key).toMatch(/^[a-z]+$/);
    }
  });

  it("nema duplikata po key-ju", () => {
    const keys = GALLERY_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("sadrži obuku, sminkanje, pedikir, trepavice, svadbeno", () => {
    const keys = GALLERY_CATEGORIES.map((c) => c.key);
    expect(keys).toContain("sminkanje");
    expect(keys).toContain("svadbeno");
    expect(keys).toContain("pedikir");
    expect(keys).toContain("trepavice");
    expect(keys).toContain("obuka");
  });
});

describe("isValidGalleryCategory", () => {
  it("prihvata postojeće kategorije", () => {
    expect(isValidGalleryCategory("sminkanje")).toBe(true);
    expect(isValidGalleryCategory("obuka")).toBe(true);
  });

  it("odbija nepoznate", () => {
    expect(isValidGalleryCategory("foo")).toBe(false);
    expect(isValidGalleryCategory("")).toBe(false);
    expect(isValidGalleryCategory("Šminkanje")).toBe(false); // case sensitive — keys su lowercase
  });

  it("type guard radi (TypeScript narrowing)", () => {
    const x: string = "sminkanje";
    if (isValidGalleryCategory(x)) {
      // U ovoj grani x mora biti GalleryCategory tip — kompajler propagira
      const narrowed: GalleryCategory = x;
      expect(narrowed).toBe("sminkanje");
    }
  });
});

describe("GALLERY_CATEGORY_KEYS", () => {
  it("matches GALLERY_CATEGORIES po dužini i redoslijedu", () => {
    expect(GALLERY_CATEGORY_KEYS).toEqual(
      GALLERY_CATEGORIES.map((c) => c.key),
    );
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
