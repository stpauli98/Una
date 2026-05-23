import { describe, it, expect } from "vitest";
import { buildBreadcrumbsJsonLd } from "@/lib/seo/breadcrumbs-jsonld";

const SITE = "https://upmakeup.example";

describe("buildBreadcrumbsJsonLd", () => {
  it("returns BreadcrumbList with @context schema.org", () => {
    const out = buildBreadcrumbsJsonLd(
      [{ name: "Početna", path: "/" }, { name: "Usluge", path: "/usluge" }],
      SITE,
    );
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("BreadcrumbList");
  });

  it("emits one ListItem per item with correct position", () => {
    const out = buildBreadcrumbsJsonLd(
      [
        { name: "Početna", path: "/" },
        { name: "Usluge", path: "/usluge" },
      ],
      SITE,
    );
    expect(out.itemListElement).toHaveLength(2);
    expect(out.itemListElement[0].position).toBe(1);
    expect(out.itemListElement[0].name).toBe("Početna");
    expect(out.itemListElement[0].item).toBe(`${SITE}/`);
    expect(out.itemListElement[1].position).toBe(2);
    expect(out.itemListElement[1].name).toBe("Usluge");
    expect(out.itemListElement[1].item).toBe(`${SITE}/usluge`);
  });

  it("strips trailing whitespace + slash from siteUrl via normalizeSiteUrl", () => {
    const out = buildBreadcrumbsJsonLd(
      [{ name: "Usluge", path: "/usluge" }],
      "https://upmakeup.example\n",
    );
    expect(out.itemListElement[0].item).toBe("https://upmakeup.example/usluge");
  });

  it("handles a single-item trail (just root)", () => {
    const out = buildBreadcrumbsJsonLd([{ name: "Početna", path: "/" }], SITE);
    expect(out.itemListElement).toHaveLength(1);
    expect(out.itemListElement[0].position).toBe(1);
    expect(out.itemListElement[0].item).toBe(`${SITE}/`);
  });

  it("preserves path exactly (no encoding)", () => {
    const out = buildBreadcrumbsJsonLd(
      [{ name: "O meni", path: "/o-meni" }],
      SITE,
    );
    expect(out.itemListElement[0].item).toBe(`${SITE}/o-meni`);
  });

  it("root path '/' resolves to siteUrl + trailing slash", () => {
    const out = buildBreadcrumbsJsonLd([{ name: "Početna", path: "/" }], SITE);
    expect(out.itemListElement[0].item).toBe(`${SITE}/`);
  });

  it("non-root path does not produce double slash", () => {
    const out = buildBreadcrumbsJsonLd(
      [{ name: "Galerija", path: "/galerija" }],
      "https://upmakeup.example/",
    );
    expect(out.itemListElement[0].item).toBe("https://upmakeup.example/galerija");
  });

  it("empty items array returns empty itemListElement (does not throw)", () => {
    const out = buildBreadcrumbsJsonLd([], SITE);
    expect(out.itemListElement).toEqual([]);
  });
});
