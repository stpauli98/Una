"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  TERMINI_PREFS_COOKIE,
  DASHBOARD_DATE_COOKIE,
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

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${COMMON_ATTRS}${SECURE_ATTR}`;
}

export function AdminPrefsPersister() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname === "/admin/termini") {
      const prefs: TerminiPrefs = {};
      const date = searchParams.get("date");
      const range = searchParams.get("range");
      const status = searchParams.get("status");
      const sort = searchParams.get("sort");
      if (date) prefs.date = date;
      if (range) prefs.range = range as TerminiPrefs["range"];
      if (status) prefs.status = status as TerminiPrefs["status"];
      if (sort) prefs.sort = sort as TerminiPrefs["sort"];

      // Zapiši samo kad postoji bar jedan eksplicitni izbor.
      // Inače bi prvi posjet brisao postojeći cookie.
      if (Object.keys(prefs).length > 0) {
        writeCookie(TERMINI_PREFS_COOKIE, serializeTerminiPrefs(prefs));
      }
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
