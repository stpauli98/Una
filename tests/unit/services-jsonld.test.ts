import { describe, it, expect } from "vitest";
import { buildServicesJsonLd } from "@/lib/seo/services-jsonld";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

const SITE = "https://upbeauty.example";

// Reusable test factory
function service(over: Partial<Service> = {}): Service {
  return {
    id: 1,
    name: "Standard šminkanje",
    description: "Klasično dnevno šminkanje za svaku priliku.",
    price: 70,
    price_note: null,
    duration_min: 60,
    duration_note: null,
    category: "sminkanje",
    image_path: null,
    bookable: true,
    active: true,
    variable_price: false,
    order_index: 1,
    created_at: "2026-05-01T00:00:00Z",
    ...over,
  } as Service;
}

describe("buildServicesJsonLd", () => {
  it("returns an ItemList with @context schema.org", () => {
    const out = buildServicesJsonLd([service()], SITE);
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("ItemList");
  });

  it("name field references brand + Gradiška", () => {
    const out = buildServicesJsonLd([service()], SITE);
    expect(out.name).toMatch(/Gradišci|Gradiška/);
    expect(out.name).toMatch(/UP Makeup/);
  });

  it("handles empty services array without throwing", () => {
    const out = buildServicesJsonLd([], SITE);
    expect(out.itemListElement).toEqual([]);
  });

  it("wraps each service as a ListItem with position", () => {
    const out = buildServicesJsonLd(
      [service({ id: 1 }), service({ id: 2, name: "Glam šminkanje" })],
      SITE,
    );
    expect(out.itemListElement).toHaveLength(2);
    expect(out.itemListElement[0].position).toBe(1);
    expect(out.itemListElement[0].item["@type"]).toBe("Service");
    expect(out.itemListElement[1].position).toBe(2);
    expect(out.itemListElement[1].item.name).toBe("Glam šminkanje");
  });

  it("service @id is stable per service id", () => {
    const out = buildServicesJsonLd([service({ id: 42 })], SITE);
    expect(out.itemListElement[0].item["@id"]).toBe(`${SITE}/usluge#service-42`);
  });

  it("service links to BeautySalon provider via @id", () => {
    const out = buildServicesJsonLd([service()], SITE);
    expect(out.itemListElement[0].item.provider).toEqual({ "@id": `${SITE}/#business` });
  });

  it("areaServed is City Gradiška", () => {
    const out = buildServicesJsonLd([service()], SITE);
    expect(out.itemListElement[0].item.areaServed).toEqual({
      "@type": "City",
      name: "Gradiška",
    });
  });

  it("maps category to human-readable serviceType + category", () => {
    const cases: Array<{ cat: Service["category"]; expected: string }> = [
      { cat: "sminkanje", expected: "Šminkanje" },
      { cat: "pedikir", expected: "Pedikir" },
      { cat: "trepavice", expected: "Trepavice" },
      { cat: "obuka", expected: "Obuka šminkanja" },
    ];
    for (const { cat, expected } of cases) {
      const out = buildServicesJsonLd([service({ category: cat })], SITE);
      expect(out.itemListElement[0].item.serviceType).toBe(expected);
      expect(out.itemListElement[0].item.category).toBe(expected);
    }
  });

  it("includes description when present", () => {
    const out = buildServicesJsonLd([service({ description: "Hej" })], SITE);
    expect(out.itemListElement[0].item.description).toBe("Hej");
  });

  it("omits description field when null", () => {
    const out = buildServicesJsonLd([service({ description: null })], SITE);
    expect(out.itemListElement[0].item).not.toHaveProperty("description");
  });

  it("includes estimatedDuration as ISO 8601 when duration_min is set", () => {
    const out = buildServicesJsonLd([service({ duration_min: 90 })], SITE);
    expect(out.itemListElement[0].item.estimatedDuration).toBe("PT90M");
  });

  it("omits estimatedDuration when duration_min is null", () => {
    const out = buildServicesJsonLd([service({ duration_min: null })], SITE);
    expect(out.itemListElement[0].item).not.toHaveProperty("estimatedDuration");
  });

  it("fixed-price service has numeric Offer.price in BAM", () => {
    const out = buildServicesJsonLd([service({ price: 70, variable_price: false })], SITE);
    const offer = out.itemListElement[0].item.offers!;
    expect(offer["@type"]).toBe("Offer");
    expect(offer.price).toBe(70);
    expect(offer.priceCurrency).toBe("BAM");
    expect(offer.availability).toBe("https://schema.org/InStock");
  });

  it("variable-price service uses priceSpecification with price_note description", () => {
    const out = buildServicesJsonLd(
      [service({ price: null, variable_price: true, price_note: "Od 150 KM" })],
      SITE,
    );
    const offer = out.itemListElement[0].item.offers!;
    expect(offer.priceCurrency).toBe("BAM");
    expect(offer).not.toHaveProperty("price");
    expect(offer.priceSpecification).toEqual({
      "@type": "PriceSpecification",
      priceCurrency: "BAM",
      description: "Od 150 KM",
    });
  });

  it("variable-price service WITHOUT price_note has no Offer", () => {
    const out = buildServicesJsonLd(
      [service({ price: null, variable_price: true, price_note: null })],
      SITE,
    );
    expect(out.itemListElement[0].item).not.toHaveProperty("offers");
  });

  it("bookable service Offer.url points to /zakazi?service={id}", () => {
    const out = buildServicesJsonLd([service({ id: 7, bookable: true })], SITE);
    expect(out.itemListElement[0].item.offers!.url).toBe(`${SITE}/zakazi?service=7`);
  });

  it("non-bookable service Offer.url points to /usluge (catalog)", () => {
    const out = buildServicesJsonLd([service({ id: 7, bookable: false })], SITE);
    expect(out.itemListElement[0].item.offers!.url).toBe(`${SITE}/usluge`);
  });

  it("strips trailing slash from siteUrl to avoid double slash", () => {
    const out = buildServicesJsonLd([service({ id: 1 })], "https://upbeauty.example/");
    expect(out.itemListElement[0].item["@id"]).toBe("https://upbeauty.example/usluge#service-1");
    expect(out.itemListElement[0].item.provider["@id"]).toBe("https://upbeauty.example/#business");
  });

  it("strips trailing newline from siteUrl (Vercel env var bug)", () => {
    // Regression: NEXT_PUBLIC_SITE_URL na produkciji je sadržao literalni `\n`
    // sa kraja, što je curilo u sredinu Schema.org @id polja
    // (npr. "...vercel.app\n/usluge#service-1"). Google parser je takve
    // URL-ove odbijao i ruskao rich-result eligibility.
    const out = buildServicesJsonLd([service({ id: 1 })], "https://upbeauty.example\n");
    expect(out.itemListElement[0].item["@id"]).toBe("https://upbeauty.example/usluge#service-1");
    expect(out.itemListElement[0].item.provider["@id"]).toBe("https://upbeauty.example/#business");
    expect(out.itemListElement[0].item.offers!.url).toBe("https://upbeauty.example/zakazi?service=1");
  });
});
