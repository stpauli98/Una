# Availability Visibility Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kalendar na `/zakazi` mora sakriti slotove koji su već rezervisani od strane drugih klijenata.

**Architecture:** `/api/availability` route prebacuje sa anon Supabase klijenta na service role klijent. Browser i dalje dobija samo listu slobodnih slotova (nikad sirove termine). Uz fix, dodaje se cache barrier i novi E2E regression test koji failuje sa pre-fix kodom i prolazi sa post-fix.

**Tech Stack:** Next.js 16 App Router, Supabase (service role) iz route handlera, Playwright e2e, Vitest unit.

---

## Context — Root cause (pročitaj prije prvog task-a)

Bug koji fiksujemo: klijent A rezerviše utorak 17:00. Klijent B otvori `/zakazi`, izabere isti utorak — vidi 17:00 kao slobodan. Popuni cijelu formu, klikne Potvrdi — tek tada dobije grešku "Ovaj termin je upravo zauzet" iz race guard-a u server action-u.

Razlog: `/api/availability` koristi `createClient()` iz `@/lib/supabase/server.ts` koji koristi **anon key**. RLS politike za tabelu `appointments` (vidi `supabase/migrations/20260409100100_rls_policies.sql`) dozvoljavaju anon samo `INSERT`, ne i `SELECT`. Posljedica: upit `sb.from("appointments").select("start_time,end_time").in("status", ["ceka", "potvrdjen"])` vraća `[]` za anon, i `computeAvailableSlots` prima `existing: []` → sve slotove vraća kao slobodne.

Provjera da je to zaista uzrok:

```bash
# 1. Preko anon REST — curi prazan array
curl "http://127.0.0.1:54321/rest/v1/appointments?select=id,start_time,status" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# => []

# 2. Direktan SQL — vidi sve
docker exec supabase_db_up-beauty psql -U postgres -d postgres \
  -c "SELECT id, start_time, status FROM appointments WHERE status IN ('ceka','potvrdjen');"
# => stvarni termini
```

Fix je namjerno minimalni: 2 linije kôda u `route.ts` plus 2 nova export-a za cache. Sve ostalo je test infrastruktura i verifikacija.

---

## File Structure Overview

Izmjena u 1 source fajlu + 1 novi test fajl. Nema novih modula, nema restrukturiranja.

```
up-beauty/
├─ src/
│  └─ app/api/availability/route.ts            ← MODIFY (2 lines source + 2 new exports)
└─ tests/
   └─ e2e/booking-conflict.spec.ts             ← CREATE (regression test)
```

Fajlovi koje **čitamo za kontekst ali ne mijenjamo**:
- `src/lib/supabase/admin.ts` — `createAdminClient()` koju importujemo
- `src/lib/supabase/server.ts` — iz kojeg uklanjamo import
- `src/app/zakazi/actions.ts` — primjer pattern-a (isto koristi admin klijent)
- `supabase/migrations/20260409100100_rls_policies.sql` — potvrda RLS politika

---

## Task 1: Verify the bug reproduces with a failing E2E test

Ovaj task pravi **regression test PRIJE fix-a**. Cilj je da test failuje sa trenutnim kodom (dokazujući bug), pa da Task 2 (fix) ga uzme zelenim.

**Files:**
- Create: `tests/e2e/booking-conflict.spec.ts`

- [ ] **Step 1: Pročitaj postojeću e2e strukturu**

Read: `tests/e2e/booking.spec.ts` (postojeći happy-path, koristi iste selektore i kalendar flow — treba nam identičan obrazac da bismo uhvatili dan/slot).

Čitaj: `playwright.config.ts`. Potvrdi da je `baseURL` `http://localhost:3000` i da postoji `PLAYWRIGHT_SKIP_WEB_SERVER` opcija.

Čitaj: `.env.local`. Potvrdi da `SUPABASE_SERVICE_ROLE_KEY` postoji i da je anon URL u `NEXT_PUBLIC_SUPABASE_URL` (za lokalni dev je `http://192.168.100.9:54321` ali Playwright test će koristiti `http://127.0.0.1:54321` jer testovi rade lokalno na istoj mašini).

- [ ] **Step 2: Napiši regression test**

Create `tests/e2e/booking-conflict.spec.ts` sa sljedećim sadržajem:

```ts
import { test, expect } from "@playwright/test";
import { addDays, format, getDay } from "date-fns";

/**
 * Regression test za bug: klijent B ne smije vidjeti kao slobodan slot
 * koji je klijent A već rezervisao. Prije fix-a, ovaj test failuje —
 * jer anon RLS politika na `appointments` tabeli blokira SELECT pa
 * /api/availability nikad ne dobije postojeće termine.
 *
 * Seed: preko Supabase REST API sa service role ključem ubacujemo jedan
 * termin. Cleanup: u afterEach, istim putem brišemo samo taj termin.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

/** Nađi prvi weekday (pon-pet) najmanje 3 dana u budućnosti. */
function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  // Postavi na 17:00 lokalno (radno vrijeme weekday-a počinje 17:00).
  date.setHours(17, 0, 0, 0);
  return date;
}

async function insertAppointment(start: Date): Promise<number> {
  if (!SERVICE_ROLE_KEY) throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      service_id: 1,
      client_name: "E2E Conflict Test",
      client_phone: "+38765999888",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "ceka",
    }),
  });
  if (!res.ok) throw new Error(`Seed insert failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

async function deleteAppointment(id: number): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

test("booking conflict — taken slot is hidden from other clients", async ({ page }) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY env var nije postavljen");
  }

  const target = nextBookableWeekday();
  const dayNumber = target.getDate();
  const seededId = await insertAppointment(target);

  try {
    // Klijent B dolazi na /zakazi, bira Šminkanje (service_id=1, 60min)
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    // Bira isti dan
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    // Sačekaj da se slotovi učitaju
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    // Pročitaj sve vidljive slot dugmeta
    const slotButtons = page.getByRole("button").filter({ hasText: /^\d{2}:\d{2}$/ });
    const slotTexts = await slotButtons.allTextContents();

    // Glavna assertion — 17:00 slot NE smije biti u listi
    expect(slotTexts).not.toContain("17:00");

    // Sanity — drugi slotovi moraju i dalje postojati
    expect(slotTexts.length).toBeGreaterThan(0);
    expect(slotTexts).toContain("18:00");
  } finally {
    await deleteAppointment(seededId);
  }
});
```

- [ ] **Step 3: Pokreni test, očekuj FAIL**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test tests/e2e/booking-conflict.spec.ts --reporter=list
```

Expected: **1 failed**. Greška će biti na `expect(slotTexts).not.toContain("17:00")` jer bug još nije popravljen — slot 17:00 je vidljiv uprkos postojećem terminu.

Ako test prolazi umjesto da failuje → STANI. To znači ili da je bug već nekako popravljen, ili da seed nije uspio, ili da Playwright ne može pristupiti `127.0.0.1:54321`. Provjeri u tom slučaju:
```bash
curl -s http://127.0.0.1:54321/rest/v1/appointments?select=id \
  -H "apikey: $(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  -H "Authorization: Bearer $(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)"
```
Treba vratiti JSON listu, ne `[]` ako ima termina, ne error.

- [ ] **Step 4: Commit failing test**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add tests/e2e/booking-conflict.spec.ts && \
  git commit -m "test(booking): regression for visible-but-taken slot bug

New E2E test seeds an appointment via Supabase REST + service role,
then checks that /zakazi?service=1 calendar does not offer that slot
to a different client. Currently FAILS — anon RLS blocks
/api/availability from seeing existing appointments, so every slot
appears free. Fix in next commit."
```

---

## Task 2: Fix the API route to use admin client and add cache barriers

**Files:**
- Modify: `src/app/api/availability/route.ts`

- [ ] **Step 1: Pročitaj trenutni `route.ts`**

Read: `src/app/api/availability/route.ts`. Treba ti kontekst svih 89 linija jer plan mijenja 2 linije kôda + 2 nova izvoza.

- [ ] **Step 2: Pročitaj `admin.ts` kao potvrdu API-ja**

Read: `src/lib/supabase/admin.ts`. Potvrdi potpis — `createAdminClient()` je sinhrona funkcija (nema `await`), za razliku od `createClient()` iz `server.ts` koja je async.

- [ ] **Step 3: Napravi izmjene u `route.ts`**

Modify `src/app/api/availability/route.ts`.

Promjena 1: Import na vrhu fajla.
Stara linija (1-4):
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { computeAvailableSlots } from "@/lib/booking/availability";
```

Nova linija (1-4):
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/booking/availability";
```

Promjena 2: Dodaj cache barrier odmah ispod importa. Umetnuti između postojećeg komentarskog bloka i `export async function GET`:

```ts
// Ova ruta mora uvijek čitati svježe podatke — baza se mijenja u realnom
// vremenu kada klijenti rezervišu termine. Keš bi prikazao zastarjele slotove.
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

Promjena 3: Zamijeni `const sb = await createClient();` sa `const sb = createAdminClient();`. Trenutna lokacija je linija 34.

- [ ] **Step 4: Potvrdi tačno stanje fajla**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  head -10 src/app/api/availability/route.ts
```

Expected output (prvih 10 linija):
```ts
import { NextResponse, type NextRequest } from "next/server";
import { parseISO, startOfDay, endOfDay } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/booking/availability";

// Ova ruta mora uvijek čitati svježe podatke — baza se mijenja u realnom
// vremenu kada klijenti rezervišu termine. Keš bi prikazao zastarjele slotove.
export const dynamic = "force-dynamic";
export const revalidate = 0;

```

Dalje, potvrdi da `createClient` nigdje nije ostao:
```bash
grep -n "createClient\|createAdminClient" src/app/api/availability/route.ts
```
Expected: samo jedan pogodak `createAdminClient` na liniji 3 i jedan pogodak `createAdminClient()` negdje između 34-40.

- [ ] **Step 5: Typecheck**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run typecheck
```
Expected: prazan stdout (nema grešaka).

- [ ] **Step 6: Pokreni regression test, očekuj PASS**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test tests/e2e/booking-conflict.spec.ts --reporter=list
```
Expected: **1 passed**.

Ako još failuje → ili Next.js dev server nije pokupio novi kod (HMR ga treba automatski osvježiti, ali ako nešto čudno — `pkill -f 'next dev'` pa restart preko `preview_start`), ili je `.env.local` prazan za `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 7: Commit fix**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  git add src/app/api/availability/route.ts && \
  git commit -m "fix(booking): availability route uses admin client so taken slots hide

Anon RLS blocked SELECT on appointments, so /api/availability always
received existing=[] and reported every slot as free. Other clients
only hit the taken-slot error after filling the whole booking form
(via the server action race guard).

Switch to createAdminClient() — the browser still receives only the
computed list of free slots, never raw appointment data. RLS remains
untouched; service role key stays server-side (admin.ts has
\"server-only\" import).

Also add dynamic=force-dynamic and revalidate=0 to prevent Next.js
from caching stale slot lists between concurrent bookings.

Regression test: tests/e2e/booking-conflict.spec.ts (added in
previous commit, now passes)."
```

---

## Task 3: Full test suite regression check

Provjera da ništa drugo nije polomljeno.

- [ ] **Step 1: Unit testovi**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test
```
Expected: **Test Files 6 passed (6), Tests 73 passed (73)**.

- [ ] **Step 2: Svi E2E testovi**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && \
  E2E_SUPABASE_SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)" \
  E2E_ADMIN_PASSWORD='Test1312..' \
  PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  npx playwright test --reporter=list
```
Expected: **5 passed** (postojeća 4 + novi booking-conflict).

- [ ] **Step 3: Production build (opcioni ali preporučen)**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm run build
```
Expected: build uspješan, u listi ruta `/api/availability` označena kao `ƒ (Dynamic)` (force-dynamic export je potvrđen).

Ako build failuje sa greškom vezanom za `dynamic = "force-dynamic"` na route handleru → znači da je redoslijed exporta pogrešan. Next.js 16 očekuje `dynamic` export PRIJE `GET` handlera u istom fajlu. Ako tako nešto iskoči, premjesti `export const dynamic` i `export const revalidate` linije odmah iznad `export async function GET(...)`.

---

## Task 4: Manual live verification through the browser

Kod ispravljen, testovi zeleni — ostaje da uživo kroz preview browser izgleda dobro.

- [ ] **Step 1: Provjeri da preview server radi**

Tool: `mcp__Claude_Preview__preview_list`. Ako `next-dev` nije running, `mcp__Claude_Preview__preview_start` sa `name: "next-dev"`.

- [ ] **Step 2: Seed testni termin u bazi**

Run:
```bash
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c "
INSERT INTO appointments (service_id, client_name, client_phone, start_time, end_time, status)
VALUES (
  1,
  'Manual Verify A',
  '+38765000001',
  (date_trunc('day', NOW() + interval '4 days')::date + time '17:00') AT TIME ZONE 'Europe/Sarajevo',
  (date_trunc('day', NOW() + interval '4 days')::date + time '18:00') AT TIME ZONE 'Europe/Sarajevo',
  'ceka'
)
RETURNING id, start_time;
"
```
Zapamti vraćeni ID i datum. (Napomena: ako dan koji nam pada na `+4 days` padne na weekend, samo pomjeri na `+5 days` ili `+6`; ili ostavi — weekend je otvoren od 05:00, pa će 17:00 i dalje biti radni slot, samo drugi slotovi će biti drugačiji.)

- [ ] **Step 3: Otvori /zakazi?service=1 i navigiraj do ciljnog dana**

Koristi `mcp__Claude_Preview__preview_eval`:

```js
location.href = 'http://localhost:3000/zakazi?service=1'
```

Pa nakon kratke pauze:

```js
(async () => {
  // klikni odgovarajući dan — zamijeni DAY_NUMBER konkretnom vrijednošću iz Step 2
  const DAY_NUMBER = /* npr. 13 */;
  const btns = Array.from(document.querySelectorAll('.grid.grid-cols-7 button:not(:disabled)'));
  const target = btns.find(b => b.textContent?.trim() === String(DAY_NUMBER));
  if (!target) return { error: 'day not found', available: btns.map(b => b.textContent?.trim()) };
  target.click();
  await new Promise(r => setTimeout(r, 2000));
  const slots = Array.from(document.querySelectorAll('button'))
    .filter(b => /^\d{2}:\d{2}$/.test(b.textContent?.trim() || ''))
    .map(b => b.textContent?.trim());
  return { slots };
})()
```

Expected: `slots` array ne sadrži `"17:00"`. Ostali slotovi (`18:00`, `19:00`, `20:00` za weekday) prisutni.

- [ ] **Step 4: Cleanup**

```bash
# Zamijeni <ID> vraćenim iz Step 2
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c \
  "DELETE FROM appointments WHERE id = <ID>;"
```

- [ ] **Step 5: Ako sve prolazi — bez commit-a (nema novih fajlova)**

Manual verification ne pravi nikakve fajlove. Ako uživo sve radi, pređi na Task 5 za finalni commit/checkpoint.

---

## Task 5: Final checkpoint

- [ ] **Step 1: Provjeri git status je čist**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && git status
```
Expected: `nothing to commit, working tree clean`. Ako je nešto slučajno ostavljeno necommit-ovano (temp fajlovi, `.next/`, itd.) — istraži prije sljedećeg koraka.

- [ ] **Step 2: Pregled historije**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && git log --oneline -5
```
Expected: vidjeti 2 nova commit-a pored spec commit-a:
```
<hash> fix(booking): availability route uses admin client so taken slots hide
<hash> test(booking): regression for visible-but-taken slot bug
<hash> docs: spec for availability visibility fix
```

- [ ] **Step 3: Generiši kratak summary za korisnika**

Output short text (ne commit) koji sumira šta je urađeno:

> Fix kompletan. Izmijenjen `/api/availability` da koristi service role klijent — `computeAvailableSlots` sada dobija stvarne postojeće termine iz baze i pravilno ih isključuje iz liste slobodnih slotova. Dodan novi E2E test `booking-conflict.spec.ts` koji pokriva tačno scenario iz bug reporta. Svi postojeći testovi prolaze.

---

## Verification Checklist

Prije nego što kažeš da si gotov, svaki od ovih mora biti istinit:

- [ ] `npm run typecheck` — čist
- [ ] `npm test` — 73 unit testova prolaze
- [ ] `npm run test:e2e` — 5 e2e testova prolaze (uključujući novi booking-conflict)
- [ ] `npm run build` — production build prolazi (opcioni)
- [ ] Manuelna verifikacija kroz preview browser — seed termin → kalendar ne prikazuje njegov slot
- [ ] Git istorija ima 2 nova commit-a (test first, pa fix) + spec iz brainstorming faze
- [ ] `/api/availability` u listi ruta `npm run build` označen kao `ƒ (Dynamic)`
