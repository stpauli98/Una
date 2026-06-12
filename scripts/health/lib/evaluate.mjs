// scripts/health/lib/evaluate.mjs
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const TZ = "Europe/Sarajevo";

/** FK-proba: POST sa nepostojećim service_id. Jedini zdrav ishod je FK violation. */
export function evaluateFkProbe(httpStatus, body) {
  const code = body?.code;
  if (code === "23503")
    return { status: "PASS", detail: "put upisa zdrav (gateway → anon ključ → RLS → FK)" };
  if (code === "42501")
    return { status: "FAIL", detail: `RLS odbija anon INSERT — isti mehanizam kao bug bf82018: ${body?.message ?? ""}` };
  if (httpStatus === 401)
    return { status: "FAIL", detail: "anon ključ odbijen na gateway-u (401) — ključ rotiran/nevalidan?" };
  if (httpStatus >= 200 && httpStatus < 300)
    return { status: "FAIL", detail: "proba sa nepostojećim service_id je PROŠLA — FK constraint nedostaje?!" };
  return { status: "FAIL", detail: `neočekivan odgovor ${httpStatus}: ${JSON.stringify(body).slice(0, 200)}` };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function evaluateSlotsShape(dateStr, httpStatus, body) {
  if (httpStatus !== 200) return { ok: false, count: 0, detail: `${dateStr}: HTTP ${httpStatus}` };
  if (!Array.isArray(body?.slots)) return { ok: false, count: 0, detail: `${dateStr}: nema slots niza` };
  for (const s of body.slots) {
    if (!ISO.test(s?.start ?? "") || !ISO.test(s?.end ?? ""))
      return { ok: false, count: 0, detail: `${dateStr}: slot bez validnog start/end` };
  }
  return { ok: true, count: body.slots.length, detail: `${dateStr}: ${body.slots.length} slotova` };
}

/**
 * hours: { [0..6]: {open:"HH:mm", close:"HH:mm", isOpen} } — ista konvencija kao DB (0=ned).
 * Pretpostavlja dnevno radno vrijeme (open < close istog dana) — ne podržava
 * intervale preko ponoći.
 */
export function slotWithinHours(startIso, endIso, hours) {
  const start = new Date(startIso);
  const weekday = toZonedTime(start, TZ).getDay();
  const h = hours[weekday];
  if (!h || !h.isOpen) return false;
  const s = formatInTimeZone(start, TZ, "HH:mm");
  const e = formatInTimeZone(new Date(endIso), TZ, "HH:mm");
  return s >= h.open && e <= h.close;
}

export function evaluateBookingAge(daysSince, thresholdDays) {
  if (daysSince == null)
    return { status: "WARN", detail: "nijedna javna rezervacija u bazi (confirmation_token is null svuda)" };
  if (daysSince > thresholdDays)
    return { status: "WARN", detail: `zadnja javna rezervacija prije ${Math.round(daysSince)} dana (prag ${thresholdDays})` };
  return { status: "PASS", detail: `zadnja javna rezervacija prije ${Math.round(daysSince)} dana` };
}
