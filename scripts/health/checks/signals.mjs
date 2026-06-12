// scripts/health/checks/signals.mjs
import { sqlQuery, getAnonKey } from "../lib/mgmt-api.mjs";
import { evaluateFkProbe, evaluateSlotsShape, slotWithinHours, evaluateBookingAge } from "../lib/evaluate.mjs";
import { formatInTimeZone } from "date-fns-tz";

const L = "signals";
const TZ = "Europe/Sarajevo";

function guard(id, fn) {
  return fn().catch((e) => ({ id, layer: L, status: "FAIL", detail: `provjera nije mogla da se izvrši: ${e.message}` }));
}

/** Datum string za N dana unaprijed, u Sarajevo zoni (podne-anchor zbog DST). */
function dateStrPlus(days) {
  const noonToday = new Date(`${formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")}T12:00:00Z`);
  return formatInTimeZone(new Date(noonToday.getTime() + days * 86_400_000), TZ, "yyyy-MM-dd");
}

export async function runSignalChecks(env) {
  const supabaseUrl = `https://${env.SUPABASE_PROJECT_REF}.supabase.co`;
  const site = env.SITE_URL.replace(/\/$/, "");
  const results = [];

  // 1. FK-proba upisa — JEDINI write-shaped poziv; service_id=999999 ne postoji
  //    pa FK violation garantuje da se ništa ne upisuje i nikakav email ne šalje.
  results.push(await guard("fk-write-probe", async () => {
    const anon = await getAnonKey(env);
    const res = await fetch(`${supabaseUrl}/rest/v1/appointments`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        service_id: 999999, client_name: "[HEALTH-PROBE]", client_phone: "+38765000000",
        start_time: "2030-01-01T10:00:00Z", end_time: "2030-01-01T11:00:00Z",
        status: "ceka", confirmation_token: crypto.randomUUID(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    const ev = evaluateFkProbe(res.status, body);
    return { id: "fk-write-probe", layer: L, ...ev };
  }));

  // 2.+6. Availability oblik za narednih 7 dana + slot konzistencija za sutra
  results.push(...await (async () => {
    try {
      const svc = await sqlQuery(env, "select id from services where bookable and active and duration_min is not null order by id limit 1");
      if (!svc.length) return [{ id: "availability-7d", layer: L, status: "FAIL", detail: "nijedna bookable usluga u bazi" }];
      const serviceId = svc[0].id;
      const hoursRows = await sqlQuery(env, "select day_of_week, open_time, close_time, is_open from working_hours");
      const hours = Object.fromEntries(hoursRows.map((r) => [r.day_of_week, { open: r.open_time.slice(0, 5), close: r.close_time.slice(0, 5), isOpen: r.is_open }]));

      const out = [];
      let total = 0;
      let shapeProblem = null;
      let tomorrowSlots = [];
      let tomorrowOk = false;
      for (let d = 1; d <= 7; d++) {
        const dateStr = dateStrPlus(d);
        const res = await fetch(`${site}/api/availability?date=${dateStr}&service_id=${serviceId}`);
        const body = await res.json().catch(() => ({}));
        const ev = evaluateSlotsShape(dateStr, res.status, body);
        if (!ev.ok && !shapeProblem) shapeProblem = ev.detail;
        total += ev.count;
        if (d === 1 && ev.ok) { tomorrowSlots = body.slots; tomorrowOk = true; }
      }
      out.push(shapeProblem
        ? { id: "availability-7d", layer: L, status: "FAIL", detail: shapeProblem }
        : total === 0
          ? { id: "availability-7d", layer: L, status: "WARN", detail: "0 slotova u narednih 7 dana (popunjeno ili bug?)" }
          : { id: "availability-7d", layer: L, status: "PASS", detail: `${total} slotova u narednih 7 dana` });

      if (!tomorrowOk) {
        out.push({ id: "slot-consistency", layer: L, status: "FAIL", detail: "nije provjereno — availability za sutra nije vratio validne slotove" });
      } else {
        const bad = tomorrowSlots.filter((s) => !slotWithinHours(s.start, s.end, hours));
        out.push(bad.length === 0
          ? { id: "slot-consistency", layer: L, status: "PASS", detail: `svi sutrašnji slotovi (${tomorrowSlots.length}) unutar radnog vremena` }
          : { id: "slot-consistency", layer: L, status: "FAIL", detail: "API nudi slotove van radnog vremena — generisanje i validacija se razilaze (lekcija 53a2f55)", actual: bad.map((s) => s.start).join(", ") });
      }
      return out;
    } catch (e) {
      const detail = `provjera nije mogla da se izvrši: ${e.message}`;
      return [
        { id: "availability-7d", layer: L, status: "FAIL", detail },
        { id: "slot-consistency", layer: L, status: "FAIL", detail },
      ];
    }
  })());

  // 3. ISR sadržaj
  results.push(await guard("isr-content", async () => {
    const cjen = await fetch(`${site}/cjenovnik`).then((r) => r.text());
    const uslg = await fetch(`${site}/usluge`).then((r) => r.text());
    const zakazi = await fetch(`${site}/zakazi`);
    const home = await fetch(site);
    const problems = [];
    if (!cjen.includes("KM")) problems.push("/cjenovnik bez cijena");
    if ((uslg.match(/<h3/g) ?? []).length < 5) problems.push("/usluge ima <5 usluga");
    if (zakazi.status !== 200) problems.push(`/zakazi HTTP ${zakazi.status}`);
    if (home.status !== 200) problems.push(`/ HTTP ${home.status}`);
    return problems.length === 0
      ? { id: "isr-content", layer: L, status: "PASS", detail: "sve javne stranice renderuju sadržaj" }
      : { id: "isr-content", layer: L, status: "FAIL", detail: problems.join("; ") };
  }));

  // 4. Starost zadnje javne rezervacije
  results.push(await guard("public-booking-age", async () => {
    const rows = await sqlQuery(env, "select extract(epoch from (now() - max(created_at)))/86400.0 as days from appointments where confirmation_token is not null");
    const days = rows[0]?.days === null ? null : Number(rows[0].days);
    return { id: "public-booking-age", layer: L, ...evaluateBookingAge(days, 14) };
  }));

  // 5. Integritet podataka
  results.push(await guard("data-integrity", async () => {
    const overlap = await sqlQuery(env, `
      select count(*)::int as n from appointments a join appointments b
      on a.id < b.id and tstzrange(a.start_time, a.end_time) && tstzrange(b.start_time, b.end_time)
      where a.status in ('ceka','potvrdjen') and b.status in ('ceka','potvrdjen')`);
    const outside = await sqlQuery(env, `
      select count(*)::int as n from appointments ap join working_hours wh
      on wh.day_of_week = extract(dow from ap.start_time at time zone 'Europe/Sarajevo')::int
      where ap.status in ('ceka','potvrdjen') and ap.start_time > now()
      and (not wh.is_open
           or (ap.start_time at time zone 'Europe/Sarajevo')::time < wh.open_time
           or (ap.end_time at time zone 'Europe/Sarajevo')::time > wh.close_time)`);
    const stale = await sqlQuery(env, `
      select count(*)::int as n from appointments
      where status = 'ceka' and created_at < now() - interval '3 days' and start_time > now()`);
    const problems = [];
    if (overlap[0].n > 0) problems.push(`${overlap[0].n} preklapanja aktivnih termina`);
    if (outside[0].n > 0) problems.push(`${outside[0].n} budućih termina van radnog vremena`);
    if (problems.length) return { id: "data-integrity", layer: L, status: "FAIL", detail: problems.join("; ") };
    if (stale[0].n > 0) return { id: "data-integrity", layer: L, status: "WARN", detail: `${stale[0].n} 'ceka' termina starijih od 3 dana — Una zaboravila potvrditi?` };
    return { id: "data-integrity", layer: L, status: "PASS", detail: "bez preklapanja, van-radnog-vremena i ustajalih 'ceka'" };
  }));

  return results.flat();
}
