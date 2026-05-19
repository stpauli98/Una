/**
 * Tip-safe (de)serijalizacija admin filter preference-a za cookies.
 *
 * Cookies čuvaju zadnji explicit izbor admin-a tako da pri ponovnom
 * otvaranju PWA-a / browser tab-a filteri ostaju identični. Sve
 * vrijednosti validate-ujemo pri parse-u jer cookie može doći iz
 * starije verzije app-a, korupcije, ili manuel-tampering-a.
 *
 * Cookie atributi (set ih iz klijenta preko document.cookie):
 *   Path=/admin            — public stranice ih ne vide
 *   Max-Age=31536000       — 1 godina
 *   SameSite=Lax           — third-party context ne šalje
 *   (NE HttpOnly           — JS mora da piše iz client komponente)
 */

export const TERMINI_PREFS_COOKIE = "up-admin-termini-prefs";
export const DASHBOARD_DATE_COOKIE = "up-admin-dashboard-date";

const VALID_RANGES = ["danas", "sedmica", "mjesec", "svi"] as const;
const VALID_STATUSES = [
  "svi",
  "ceka",
  "potvrdjen",
  "otkazan",
  "zavrsen",
] as const;
const VALID_SORTS = ["asc", "desc"] as const;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type TerminiPrefs = {
  date?: string;
  range?: (typeof VALID_RANGES)[number];
  status?: (typeof VALID_STATUSES)[number];
  sort?: (typeof VALID_SORTS)[number];
};

function isValidDate(v: unknown): v is string {
  return typeof v === "string" && ISO_DATE_RE.test(v);
}

function isValidRange(v: unknown): v is TerminiPrefs["range"] {
  return (
    typeof v === "string" && (VALID_RANGES as readonly string[]).includes(v)
  );
}

function isValidStatus(v: unknown): v is TerminiPrefs["status"] {
  return (
    typeof v === "string" && (VALID_STATUSES as readonly string[]).includes(v)
  );
}

function isValidSort(v: unknown): v is TerminiPrefs["sort"] {
  return (
    typeof v === "string" && (VALID_SORTS as readonly string[]).includes(v)
  );
}

/**
 * Parsira cookie string u tipizovan TerminiPrefs objekat. Sve nevalidne
 * vrijednosti se silently ignore — vraćamo prazan / partial objekat,
 * nikad ne bacamo.
 */
export function parseTerminiPrefs(cookieValue: string | undefined): TerminiPrefs {
  if (!cookieValue) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(cookieValue);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const obj = raw as Record<string, unknown>;
  const result: TerminiPrefs = {};
  if (isValidDate(obj.date)) result.date = obj.date;
  if (isValidRange(obj.range)) result.range = obj.range;
  if (isValidStatus(obj.status)) result.status = obj.status;
  if (isValidSort(obj.sort)) result.sort = obj.sort;
  return result;
}

/**
 * Serijalizuje TerminiPrefs u JSON string spreman za cookie value.
 * Undefined polja se preskaču (manji cookie).
 */
export function serializeTerminiPrefs(prefs: TerminiPrefs): string {
  const out: Record<string, string> = {};
  if (prefs.date) out.date = prefs.date;
  if (prefs.range) out.range = prefs.range;
  if (prefs.status) out.status = prefs.status;
  if (prefs.sort) out.sort = prefs.sort;
  return JSON.stringify(out);
}

/**
 * Validira dashboard date cookie — samo YYYY-MM-DD ili undefined.
 */
export function parseDashboardDate(cookieValue: string | undefined): string | undefined {
  if (cookieValue && ISO_DATE_RE.test(cookieValue)) return cookieValue;
  return undefined;
}

/**
 * Default sort izračun za Termini listu:
 *   - ASC za single-day view (date setovan ili range='danas') — jutarnji prvi.
 *   - DESC za multi-day (sedmica/mjesec/svi) — najnoviji prvi.
 *
 * Izloženo kao posebna funkcija jer i page.tsx i URL builder-i u UI-u trebaju
 * isti izračun (DRY).
 */
export function computeDefaultSort(args: {
  date: string | undefined;
  range: "danas" | "sedmica" | "mjesec" | "svi";
}): "asc" | "desc" {
  const isSingleDay = !!args.date || args.range === "danas";
  return isSingleDay ? "asc" : "desc";
}

export type ResolvedTerminiPrefs = {
  date: string | undefined;
  range: "danas" | "sedmica" | "mjesec" | "svi";
  status: "svi" | "ceka" | "potvrdjen" | "otkazan" | "zavrsen";
  sort: "asc" | "desc";
  /**
   * True ako sort nije eksplicit od user-a (ni URL ni cookie) i izveden je
   * iz date/range. URL builder-i u page.tsx koriste ovo da ne dodaju ?sort=
   * u URL kad je default (čistiji URL).
   */
  isDefaultSort: boolean;
};

/**
 * Resolve URL params + cookie u finalne, normalizovane Termini prefs.
 *
 * Per-param merge: missing URL params fallback na cookie value.
 *
 * Date/range međusobno isključivost (deterministički 4 koraka):
 *   1. date: ako URL ima range → date = urlDate (cookie date se odbacuje)
 *            inače → date = urlDate ?? cookieDate
 *   2. range: ako date postoji → range = "svi" (date pobjeđuje range)
 *             inače → range = urlRange ?? cookieRange ?? "svi"
 *   3. status: urlStatus ?? cookieStatus ?? "svi"
 *   4. sort: explicit = urlSort ?? cookieSort, sort = explicit ?? defaultSort,
 *           isDefaultSort = explicit === undefined
 */
export function resolveTerminiPrefs(
  urlParams: {
    date?: string;
    range?: string;
    status?: string;
    sort?: string;
  },
  cookiePrefs: TerminiPrefs,
): ResolvedTerminiPrefs {
  const urlDate = isValidDate(urlParams.date) ? urlParams.date : undefined;
  const urlRange = isValidRange(urlParams.range)
    ? urlParams.range
    : undefined;
  const urlStatus = isValidStatus(urlParams.status)
    ? urlParams.status
    : undefined;
  const urlSort = isValidSort(urlParams.sort) ? urlParams.sort : undefined;

  // Korak 1: date
  const date = urlRange ? urlDate : (urlDate ?? cookiePrefs.date);

  // Korak 2: range
  const range: ResolvedTerminiPrefs["range"] = date
    ? "svi"
    : (urlRange ?? cookiePrefs.range ?? "svi");

  // Korak 3: status
  const status: ResolvedTerminiPrefs["status"] =
    urlStatus ?? cookiePrefs.status ?? "svi";

  // Korak 4: sort
  const defaultSort = computeDefaultSort({ date, range });
  const explicit = urlSort ?? cookiePrefs.sort;
  const sort = explicit ?? defaultSort;
  const isDefaultSort = explicit === undefined;

  return { date, range, status, sort, isDefaultSort };
}
