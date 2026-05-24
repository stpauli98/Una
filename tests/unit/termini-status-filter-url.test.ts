import { describe, it, expect } from "vitest";
import { buildStatusFilterUrl } from "@/components/admin/TerminiStatusFilter";

describe("buildStatusFilterUrl", () => {
  it("UVIJEK setuje status=svi kad user izabere 'Svi' — regresija za 'klik na Svi ne radi'", () => {
    // Bug: ako URL builder preskoči `svi` (kao default), cookie sa
    // stale `status=ceka` pobjeđuje na server resolve-u i filter ostaje
    // isti. Eksplicitno setovanje status=svi sinhronizuje URL + cookie.
    expect(buildStatusFilterUrl("svi", "/admin/termini")).toBe(
      "/admin/termini?status=svi",
    );
  });

  it("setuje status=ceka kad user izabere 'Čeka'", () => {
    expect(buildStatusFilterUrl("ceka", "/admin/termini")).toBe(
      "/admin/termini?status=ceka",
    );
  });

  it("preserve params se dodaju uz status", () => {
    expect(
      buildStatusFilterUrl("svi", "/admin/termini", {
        range: "sedmica",
        sort: "asc",
      }),
    ).toBe("/admin/termini?status=svi&range=sedmica&sort=asc");
  });

  it("undefined / prazni preserve params se ignorišu", () => {
    expect(
      buildStatusFilterUrl("potvrdjen", "/admin/termini", {
        range: undefined,
        date: "",
        sort: "desc",
      }),
    ).toBe("/admin/termini?status=potvrdjen&sort=desc");
  });
});
