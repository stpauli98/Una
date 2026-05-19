"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  TERMINI_PREFS_COOKIE,
  DASHBOARD_DATE_COOKIE,
  parseTerminiPrefs,
  serializeTerminiPrefs,
  type TerminiPrefs,
} from "@/lib/utils/admin-prefs";

/**
 * Persistira admin filter izbore kao cookies. Mount samo u admin
 * (protected) stranicama. Ne render-uje ništa.
 *
 * Logika:
 *   - Na svaku promjenu pathname/searchParams, čita trenutne URL
 *     params i write-uje odgovarajući cookie.
 *   - `/admin/termini` → up-admin-termini-prefs (JSON sa date/range/status/sort)
 *   - `/admin/dashboard` → up-admin-dashboard-date (raw YYYY-MM-DD)
 *
 * Termini per-param merge: postojeći cookie se čita prije pisanja i
 * URL params se mergeuju preko (URL pobjeđuje per-key). Bez ovog merge-a,
 * klik na pojedinačni chip bi silently undid nalaz D (per-param merge u
 * resolveTerminiPrefs) — kao u: cookie {range: "mjesec", sort: "asc"} +
 * URL ?status=ceka bi rezultiralo cookie-jem {status: "ceka"} (range/sort
 * izgubljeni). Sa merge-om: cookie postaje {range: "mjesec", status: "ceka",
 * sort: "asc"}.
 *
 * Cookie atributi:
 *   Path=/admin           — public stranice ne dobijaju
 *   Max-Age=31536000      — 1 godina
 *   SameSite=Lax          — third-party context isključen
 *   (NE HttpOnly         — write iz JS-a; preference nisu sensitive)
 *
 * NAPOMENA: NE pišemo cookie kad URL nema NIJEDAN filter param
 * (`?` bez ničega). Razlog: korisnik koji prvi put posjeti
 * `/admin/termini` ne treba da overwrite-uje postojeći cookie sa
 * praznim stanjem; defaults se i dalje računaju serverside.
 */

const COMMON_ATTRS = "Path=/admin; Max-Age=31536000; SameSite=Lax";
const SECURE_ATTR =
  typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : "";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[2]) : undefined;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${COMMON_ATTRS}${SECURE_ATTR}`;
}

export function AdminPrefsPersister() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === "/admin/termini") {
      const date = searchParams.get("date");
      const range = searchParams.get("range");
      const status = searchParams.get("status");
      const sort = searchParams.get("sort");

      // Skip write kad URL nema NIJEDAN filter — vidi NAPOMENU iznad.
      if (!date && !range && !status && !sort) return;

      // Read postojeći cookie i merge URL params preko (URL pobjeđuje per-param).
      // Bez ovoga, klik na samo jedan chip bi resetovao ostatak cookie-ja, što
      // bi silently undid nalaz D (per-param merge u resolveTerminiPrefs).
      const existing = parseTerminiPrefs(getCookie(TERMINI_PREFS_COOKIE));
      const merged: TerminiPrefs = { ...existing };
      if (date) merged.date = date;
      if (range) merged.range = range as TerminiPrefs["range"];
      if (status) merged.status = status as TerminiPrefs["status"];
      if (sort) merged.sort = sort as TerminiPrefs["sort"];

      writeCookie(TERMINI_PREFS_COOKIE, serializeTerminiPrefs(merged));
      return;
    }

    if (pathname === "/admin/dashboard") {
      const date = searchParams.get("date");
      if (date) {
        writeCookie(DASHBOARD_DATE_COOKIE, date);
      }
    }
  }, [pathname, searchParams]);

  return null;
}
