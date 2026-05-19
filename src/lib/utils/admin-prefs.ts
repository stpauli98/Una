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
