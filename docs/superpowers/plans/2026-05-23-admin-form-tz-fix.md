# Admin form TZ fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminisati dva preostala mjesta gdje admin UI snima vremenske vrijednosti koristeći browser-local TZ umjesto Europe/Sarajevo, što daje pogrešan UTC instant kad admin nije u Sarajevo TZ.

**Architecture:** Dodati novi helper `parseSarajevoDateTime(dateStr, timeStr)` u postojeći `src/lib/utils/tz.ts` (pored `parseDateSarajevo` i `atSarajevo`), pokriti ga TZ‑invariant testovima, pa zamijeniti dva inline `new Date(\`${date}T${time}:00\`)` poziva u admin client komponentama. Fix poštuje već uspostavljenu konvenciju iz `availability.ts` i `tz.ts`.

**Tech Stack:** TypeScript strict, `date-fns-tz` (`fromZonedTime`), Vitest, Next.js 16 App Router (client components).

---

## Background — zašto je ovo bug

ECMAScript spec definiše date‑time string bez offseta (npr. `"2026-06-15T18:00:00"`) kao **local time**. Empirijska provjera:

| TZ procesa | `new Date("2026-06-15T18:00:00").toISOString()` | Sarajevo wall‑clock |
|---|---|---|
| `UTC` | `2026-06-15T18:00:00.000Z` | 20:00 |
| `Europe/Sarajevo` | `2026-06-15T16:00:00.000Z` | 18:00 ✓ |
| `America/New_York` | `2026-06-15T22:00:00.000Z` | 00:00 sljedeći dan |
| `Asia/Dubai` | `2026-06-15T14:00:00.000Z` | 16:00 |

Postojeći `isGridAligned()` (`src/lib/utils/grid.ts:8`) ne hvata grešku jer `getMinutes() % 30 === 0` ostaje true za sve gornje vrijednosti. Server prima već‑pretvoreni ISO i ne može provjeriti namjeru admina.

Dva mjesta krše konvenciju iz `src/lib/utils/tz.ts:7-10` ("Svi datum/vrijeme kalkulacije moraju koristiti ove helpere umjesto golih `new Date()`"):

- `src/components/admin/TimeBlocksManager.tsx:40` — `start_time`
- `src/components/admin/TimeBlocksManager.tsx:43` — `end_time`
- `src/components/admin/ManualAppointmentForm.tsx:96` — `start_time` u "Prilagođeno vrijeme" modu

Ostatak codebase‑a (availability engine, day‑bounds, format utili, API ruta) već koristi `fromZonedTime(..., TZ)` ispravno.

---

## File Structure

**Modify:**
- `src/lib/utils/tz.ts` — dodati `parseSarajevoDateTime` helper
- `src/components/admin/TimeBlocksManager.tsx` — zamijeniti 2 `new Date()` poziva
- `src/components/admin/ManualAppointmentForm.tsx` — zamijeniti 1 `new Date()` poziv

**Create:**
- `tests/unit/tz.test.ts` — TZ‑invariant unit testovi za `parseSarajevoDateTime` (i regresijski check za `parseDateSarajevo`/`atSarajevo` ako još nije pokriveno)

Konvencija: jedan helper za sve (datum_string, vrijeme_string) → Date konverzije; inline pozivi `fromZonedTime` u komponentama nisu dozvoljeni (DRY + diskoverabilnost).

---

## Task 1: Dodati `parseSarajevoDateTime` helper sa TZ‑invariant testovima

**Files:**
- Create: `tests/unit/tz.test.ts`
- Modify: `src/lib/utils/tz.ts`

- [ ] **Step 1: Napisati failing test za novi helper**

Kreiraj `tests/unit/tz.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSarajevoDateTime } from "@/lib/utils/tz";

describe("parseSarajevoDateTime", () => {
  it("interpretira HH:MM string kao wall-clock vrijeme u Sarajevo TZ (CEST/ljeto)", () => {
    // 15. juna je CEST (+02:00). 18:00 Sarajevo = 16:00 UTC.
    const d = parseSarajevoDateTime("2026-06-15", "18:00");
    expect(d.toISOString()).toBe("2026-06-15T16:00:00.000Z");
  });

  it("interpretira HH:MM string kao wall-clock vrijeme u Sarajevo TZ (CET/zima)", () => {
    // 15. januara je CET (+01:00). 18:00 Sarajevo = 17:00 UTC.
    const d = parseSarajevoDateTime("2026-01-15", "18:00");
    expect(d.toISOString()).toBe("2026-01-15T17:00:00.000Z");
  });

  it("podržava ponoć kao granični slučaj", () => {
    // 00:00 Sarajevo (CEST) = 22:00 UTC prethodnog dana.
    const d = parseSarajevoDateTime("2026-06-15", "00:00");
    expect(d.toISOString()).toBe("2026-06-14T22:00:00.000Z");
  });

  it("podržava :30 vrijednosti (booking grid)", () => {
    const d = parseSarajevoDateTime("2026-06-15", "18:30");
    expect(d.toISOString()).toBe("2026-06-15T16:30:00.000Z");
  });

  it("rezultat je nezavisan od procesa TZ (deterministički ISO)", () => {
    // `fromZonedTime` je TZ-invariant — bilo koji TZ procesa daje isti
    // ISO za isti (dateStr, timeStr) ulaz. Ovo je glavna garancija
    // koja bug iz TimeBlocksManager-a popravlja.
    const a = parseSarajevoDateTime("2026-06-15", "18:00").toISOString();
    const b = parseSarajevoDateTime("2026-06-15", "18:00").toISOString();
    expect(a).toBe(b);
    expect(a).toBe("2026-06-15T16:00:00.000Z");
  });
});
```

- [ ] **Step 2: Pokrenuti test — mora pasti (helper ne postoji)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/tz.test.ts
```

Očekivano: FAIL sa `parseSarajevoDateTime is not exported from "@/lib/utils/tz"` ili sličnim TS errorom.

- [ ] **Step 3: Implementirati helper u `src/lib/utils/tz.ts`**

Dodati na kraj fajla (poslije `atSarajevo`):

```ts
/**
 * Parsira (YYYY-MM-DD, HH:MM) par kao wall-clock vrijeme u Sarajevo TZ.
 *
 * Koristi se kad UI komponente (HTML <input type="date"> + time select)
 * trebaju snimiti Date u bazu. Bare `new Date(\`${date}T${time}:00\`)`
 * koristi browser-local TZ što daje pogrešan UTC ako admin nije u
 * Europe/Sarajevo (vidi `tests/unit/tz.test.ts`).
 *
 * "2026-06-15", "18:00" → Date koji predstavlja 18:00 CEST
 * (interno: 2026-06-15T16:00:00.000Z u junu)
 */
export function parseSarajevoDateTime(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, TZ);
}
```

- [ ] **Step 4: Pokrenuti test — mora proći**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/tz.test.ts
```

Očekivano: 5 testova prošlo.

- [ ] **Step 5: Provjeriti typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Očekivano: bez grešaka.

- [ ] **Step 6: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/lib/utils/tz.ts tests/unit/tz.test.ts && git commit -m "feat(tz): add parseSarajevoDateTime helper for (date,time) string inputs"
```

---

## Task 2: Migrirati `TimeBlocksManager` na helper

**Files:**
- Modify: `src/components/admin/TimeBlocksManager.tsx:40-43`

- [ ] **Step 1: Dodati import**

Otvori `src/components/admin/TimeBlocksManager.tsx`. Trenutno postoji import sa linije 9:

```tsx
import { formatDate, formatTime } from "@/lib/utils/format";
```

Dodati ispod njega:

```tsx
import { parseSarajevoDateTime } from "@/lib/utils/tz";
```

- [ ] **Step 2: Zamijeniti pozive u submit handleru**

Linije 39–44 trenutno glase:

```tsx
if (date && startTime) {
  fd.set("start_time", new Date(`${date}T${startTime}:00`).toISOString());
}
if (date && endTime) {
  fd.set("end_time", new Date(`${date}T${endTime}:00`).toISOString());
}
```

Zamijeniti sa:

```tsx
if (date && startTime) {
  fd.set("start_time", parseSarajevoDateTime(date, startTime).toISOString());
}
if (date && endTime) {
  fd.set("end_time", parseSarajevoDateTime(date, endTime).toISOString());
}
```

- [ ] **Step 3: Verifikovati grep — više nema sirovog `new Date(\`` patterna**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -n 'new Date(`' src/components/admin/TimeBlocksManager.tsx
```

Očekivano: nema pogodaka.

- [ ] **Step 4: Typecheck + lint**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck && npm run lint
```

Očekivano: bez grešaka. Ako lint javi "unused import" za `parseSarajevoDateTime` — provjeriti da li je Step 2 zaista primijenjen.

- [ ] **Step 5: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/components/admin/TimeBlocksManager.tsx && git commit -m "fix(admin/postavke): use Sarajevo TZ helper for time block start/end save"
```

---

## Task 3: Migrirati `ManualAppointmentForm` na helper

**Files:**
- Modify: `src/components/admin/ManualAppointmentForm.tsx:96`

- [ ] **Step 1: Dodati import**

Otvori `src/components/admin/ManualAppointmentForm.tsx`. Postojeći importovi (linije 4–8):

```tsx
import { format, addDays } from "date-fns";
import { createManualAppointment } from "@/app/admin/(protected)/termini/actions";
import { formatTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Database } from "@/types/database";
```

Dodati novi import ispod `formatTime` reda:

```tsx
import { parseSarajevoDateTime } from "@/lib/utils/tz";
```

- [ ] **Step 2: Zamijeniti `new Date()` u custom time grani**

Linije 90–98 trenutno glase:

```tsx
if (customMode) {
  const customDate = String(fd.get("custom_date") ?? "");
  const customTime = String(fd.get("custom_time") ?? "");
  if (customDate && customTime) {
    fd.set(
      "start_time",
      new Date(`${customDate}T${customTime}:00`).toISOString(),
    );
  }
}
```

Zamijeniti sa:

```tsx
if (customMode) {
  const customDate = String(fd.get("custom_date") ?? "");
  const customTime = String(fd.get("custom_time") ?? "");
  if (customDate && customTime) {
    fd.set(
      "start_time",
      parseSarajevoDateTime(customDate, customTime).toISOString(),
    );
  }
}
```

- [ ] **Step 3: Verifikovati grep**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -n 'new Date(`' src/components/admin/ManualAppointmentForm.tsx
```

Očekivano: nema pogodaka.

- [ ] **Step 4: Typecheck + lint**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck && npm run lint
```

Očekivano: bez grešaka.

- [ ] **Step 5: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/components/admin/ManualAppointmentForm.tsx && git commit -m "fix(admin/termini): use Sarajevo TZ helper for manual appointment custom time"
```

---

## Task 4: Regresijska zaštita — repo‑wide grep i puni test suite

**Files:**
- (read only) cijeli `src/`

- [ ] **Step 1: Repo‑wide grep — nema više sirovog `new Date(\`...T...:` patterna u src/**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -rn 'new Date(`' src/ --include="*.ts" --include="*.tsx"
```

Očekivano: nema pogodaka. Ako se nešto pojavi — ili je novouvedeni regres (vratiti se na Task 2/3) ili je legitimna upotreba (template string sa Z/offset na kraju — provjeriti i opravdati u komentaru).

- [ ] **Step 2: Pokrenuti pun unit test suite**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test
```

Očekivano: svi testovi prolaze, uključujući novi `tz.test.ts` (5 testova) i postojeće `availability.test.ts`, `day-bounds.test.ts`, `grid.test.ts`. Nema novih warninga.

- [ ] **Step 3: Pokrenuti pun production build (uključuje typecheck)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run build
```

Očekivano: build prolazi. Ako se pojavi Next 16 specifičan warning — provjeriti `node_modules/next/dist/docs/` po uputstvu iz `AGENTS.md`.

- [ ] **Step 4: Ručna verifikacija sa simuliranom ne‑Sarajevo TZ (opciono ali preporučeno)**

Pokrenuti dev server sa drugačijim TZ env i provjeriti da snimljeni time block ima ispravan UTC:

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && TZ=America/New_York npm run dev
```

Otvoriti `/admin/postavke`, kreirati time block za današnji datum 18:00–19:00. U Supabase MCP / SQL editor:

```sql
SELECT start_time, end_time FROM time_blocks ORDER BY created_at DESC LIMIT 1;
```

Očekivano: `start_time` predstavlja 18:00 Sarajevo (npr. ljeti `…T16:00:00Z`, zimi `…T17:00:00Z`), NE 18:00 NY time (`…T22:00:00Z` ljeti). Po završetku obrisati testni red.

> Bilješka: ovaj korak nije neophodan ako su Task 1 testovi prošli — oni već garantuju da helper proizvodi TZ‑invariant ISO. Korak je za dodatnu sigurnost na nivou cijelog dataflow‑a (UI → action → DB).

- [ ] **Step 5: Final commit (ako Step 1 prepoznao nešto za fixati)**

Ako Step 1 nije ništa pronašao, nema commit‑a za ovaj task. Inače napraviti pojedinačan commit po pronađenom mjestu sa porukom `fix(<scope>): use Sarajevo TZ helper for <X>`.

---

## Out of scope (za odvojen razgovor sa Unom)

- **Vikend 05:00 u `BOOKING_RULES.weekend` i `working_hours` seed‑u** (`src/lib/constants/business.ts:24`, `supabase/migrations/20260409100200_seed_data.sql`). Sumnja da je copy‑paste greška jer Una vikendom ne radi od 5 ujutro. Treba poslovnu odluku, ne tehnički fix.
- **`api/availability/route.ts:140` koristi `parseISO(b.date_from)`** umjesto `parseDateSarajevo`. Tehnički ispravno na Vercel UTC runtime‑u i lokalnom Sarajevo dev‑u, ali ne TZ‑invariant. Defense‑in‑depth promjena; nije neophodna sad.
- **`src/lib/push/send.ts:30` hardkodovan `timeZone: "Europe/Sarajevo"`** umjesto `BUSINESS.timezone`. Duplikat ali trenutno konzistentan. Cosmetic refactor.
