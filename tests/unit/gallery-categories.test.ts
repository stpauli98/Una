import { describe, it, expect } from "vitest";
import {
  GALLERY_CATEGORIES,
  GALLERY_CATEGORY_KEYS,
  isValidGalleryCategory,
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
