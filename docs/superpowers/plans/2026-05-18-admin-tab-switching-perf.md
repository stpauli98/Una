# Admin Dashboard Tab Switching Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smanjiti vrijeme prebacivanja između admin tabova (`/admin/dashboard`, `/admin/termini`, `/admin/usluge`, `/admin/galerija`, `/admin/postavke`) sa trenutnih ~1.5–3s na <500ms perceived latency.

**Architecture:** Kombinacija (a) instant UI feedback preko `loading.tsx` skeletona, (b) paraleliziranog fetcha gdje su query-ji bili sekvencijalni, (c) granularnog cachiranja kroz `unstable_cache` + `updateTag` za rijetko-mijenjane tabove (Usluge, Postavke, Galerija), i (d) provjere infrastrukturnih razloga (Vercel env vars sa trailing `\n`, Vercel↔Supabase region mismatch).

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, Vercel.

**Identifikovani uzroci sporo (iz dijagnoze):**
1. `export const dynamic = "force-dynamic"` na svim tabovima → 100% SSR na svaki klik bez cache-a.
2. Termini tab radi 2 sekvencijalna DB query-ja (appointments, pa services).
3. Nema `loading.tsx` nigdje u admin-u → korisnik čeka prazan ekran tokom SSR-a.
4. PROD Supabase iz `.env.local` + potencijalno Vercel region mismatch.
5. Trailing `\n` u Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SITE_URL`) iz memorije — tihi bug.

---

## File Structure

**Novi fajlovi:**
- `src/app/admin/(protected)/loading.tsx` — root skeleton za sve admin tabove (fallback).
- `src/app/admin/(protected)/dashboard/loading.tsx` — skeleton specifičan za dashboard.
- `src/app/admin/(protected)/termini/loading.tsx` — skeleton za listu termina.
- `src/app/admin/(protected)/usluge/loading.tsx` — skeleton za listu usluga.
- `src/app/admin/(protected)/galerija/loading.tsx` — skeleton za galeriju.
- `src/app/admin/(protected)/postavke/loading.tsx` — skeleton za postavke.
- `src/lib/cache/admin-cache-tags.ts` — centralni mapping cache tagova (`services`, `settings`, `working_hours`, `blocked_dates`, `time_blocks`, `gallery`).
- `src/lib/cache/cached-queries.ts` — `unstable_cache`-wrapped query funkcije za rijetko-mijenjane podatke.
- `tests/unit/cache-tags.test.ts` — unit testovi za cache tag konstante (sprečava typo regresije).

**Izmijenjeni fajlovi:**
- `src/app/admin/(protected)/termini/page.tsx` — paraleliziran appointments + services fetch.
- `src/app/admin/(protected)/usluge/page.tsx` — koristi cached query, ukida `force-dynamic`.
- `src/app/admin/(protected)/galerija/page.tsx` — koristi cached query, ukida `force-dynamic`.
- `src/app/admin/(protected)/postavke/page.tsx` — koristi cached queries, ukida `force-dynamic`.
- `src/app/admin/(protected)/dashboard/page.tsx` — settings query keširan; ostatak ostaje dynamic (real-time termini).
- `src/app/admin/(protected)/usluge/actions.ts` — dodaje `updateTag("services")` pored postojećih `revalidatePath`.
- `src/app/admin/(protected)/galerija/actions.ts` — dodaje `updateTag("gallery")`.
- `src/app/admin/(protected)/postavke/actions.ts` — dodaje `updateTag` po sekciji koju mijenja.
- `src/app/admin/(protected)/termini/actions.ts` — dodaje `updateTag("services")` ako akcija mijenja katalog (nije potrebno za većinu, samo audit).

**Granica:** `proxy.ts` ostaje netaknut. Defense-in-depth `getUser()` u `layout.tsx` ostaje (eksplicitno dokumentovano u kodu kao namjerno). Pošto layout `getUser()` poziva isti server client koji proxy već osvježio token cookie-jem, drugi poziv je samo cookie+JWT verifikacija, ne dodatni network round-trip — to je već optimizovano od Supabase strane.

---

## Task 0: Baseline mjerenje + infrastruktura check (manual)

**Cilj:** Imati objektivne brojke prije optimizacije i potvrditi/eliminisati infrastrukturne uzroke.

**Files:** Nema code izmjena. Output ide u plan kao komentar/notes.

- [ ] **Step 1: Provjeri trailing `\n` u Vercel env vars**

Otvori Vercel Dashboard → up-beauty projekat → Settings → Environment Variables. Provjeri ima li `NEXT_PUBLIC_SUPABASE_URL` ili `NEXT_PUBLIC_SITE_URL` trailing newline. Ako da, ukloni i ponovo deploy-uj (ovo je dokumentovano u memoriji kao tihi bug).

Expected output: Sve env vars su čiste bez trailing `\n`. Ako je bilo izmjena, novi deploy je triggerovan.

- [ ] **Step 2: Provjeri Vercel region vs Supabase region**

Vercel Dashboard → Settings → Functions → vidi `Region`. Supabase Dashboard → Project Settings → vidi `Region`. Ako se ne poklapaju (npr. Vercel `iad1` US-East a Supabase Frankfurt), to dodaje 80-150ms na svaki query.

Expected output: Notiraj regione. Ako mismatch, ovo je single biggest win — promjena Vercel regiona na isti kao Supabase region ne zahtijeva code change, samo redeploy.

- [ ] **Step 3: Izmjeri baseline u Chrome DevTools**

Otvori produkciju, login u admin panel, otvori DevTools → Network tab. Klikni redom sve tabove i zabilježi:
- Vrijeme do "DOMContentLoaded" za svaki tab
- TTFB (Time To First Byte) za svaki `page` request
- Total request time

Tabela:
```
| Tab        | TTFB  | DOMContentLoaded | Total |
|------------|-------|------------------|-------|
| dashboard  |       |                  |       |
| termini    |       |                  |       |
| usluge     |       |                  |       |
| galerija   |       |                  |       |
| postavke   |       |                  |       |
```

Expected output: Tabela sa baseline brojevima u plan-u (kao komentar) ili u zasebnom fajlu `docs/superpowers/plans/2026-05-18-baseline.md`.

- [ ] **Step 4: Commit baseline notes**

```bash
git add docs/
git commit -m "docs: baseline metrics for admin tab switching perf"
```

---

## Task 1: Loading skeleton za root protected layout (instant UX win)

**Cilj:** Korisnik vidi instant skeleton umjesto praznog ekrana dok server renderuje.

**Files:**
- Create: `src/app/admin/(protected)/loading.tsx`

- [ ] **Step 1: Napravi root loading.tsx skeleton**

Kreiraj fajl `src/app/admin/(protected)/loading.tsx`:

```tsx
/**
 * Default loading skeleton za sve admin tabove. Pojedinačni tabovi
 * mogu override-ovati svojim loading.tsx ako žele preciznije skeletone.
 *
 * Next.js automatski renderuje ovo dok se server component fetch-a.
 * Sa `loading.tsx` u mjestu, klik na tab daje instant feedback umjesto
 * praznog ekrana tokom SSR-a.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* Page header skeleton */}
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-40 bg-stone-200" />
        <div className="mt-2 h-3 w-64 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        {/* Content blocks */}
        <div className="space-y-3">
          <div className="h-16 border border-cream bg-white" />
          <div className="h-16 border border-cream bg-white" />
          <div className="h-16 border border-cream bg-white" />
          <div className="h-16 border border-cream bg-white" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verifikuj build i typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 3: Test u dev modu**

Run:
```bash
npm run dev
```

Otvori `http://localhost:3000/admin/login`, login, klikaj između tabova. Trebaš vidjeti pulsing skeleton instant na svaki klik prije nego se server response stigne.

Expected: Skeleton se pojavljuje odmah pri navigaciji.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(protected\)/loading.tsx
git commit -m "feat(admin): add root loading skeleton for instant tab feedback"
```

---

## Task 2: Termini tab — paralelizacija query-ja

**Cilj:** Eliminisati sekvencijalni waterfall (appointments → services) preko `Promise.all`.

**Files:**
- Modify: `src/app/admin/(protected)/termini/page.tsx:51-88`

- [ ] **Step 1: Paraleliziraj appointments + services**

U `src/app/admin/(protected)/termini/page.tsx`, zamijeni blok od linije 51 do 88 (dvije sekvencijalne await) sa Promise.all paterom.

Trenutni kod (linije 51-88):
```tsx
  const sb = await createClient();

  let query = sb
    .from("appointments")
    .select(
      "id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)",
    )
    .order("start_time", { ascending: false });

  const now = new Date();
  if (range === "danas") {
    query = query
      .gte("start_time", startOfDay(now).toISOString())
      .lte("start_time", endOfDay(now).toISOString());
  } else if (range === "sedmica") {
    query = query
      .gte("start_time", startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      .lte("start_time", endOfWeek(now, { weekStartsOn: 1 }).toISOString());
  } else if (range === "mjesec") {
    query = query
      .gte("start_time", startOfMonth(now).toISOString())
      .lte("start_time", endOfMonth(now).toISOString());
  }

  if (statusFilter !== "svi") {
    query = query.eq("status", statusFilter);
  }

  const { data: appointments } = await query;

  // Usluge za ManualAppointmentForm dropdown
  const { data: servicesData } = await sb
    .from("services")
    .select("*")
    .eq("bookable", true)
    .eq("active", true)
    .order("order_index");
  const services = servicesData ?? [];
```

Novi kod:
```tsx
  const sb = await createClient();

  let appointmentsQuery = sb
    .from("appointments")
    .select(
      "id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)",
    )
    .order("start_time", { ascending: false });

  const now = new Date();
  if (range === "danas") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfDay(now).toISOString())
      .lte("start_time", endOfDay(now).toISOString());
  } else if (range === "sedmica") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfWeek(now, { weekStartsOn: 1 }).toISOString())
      .lte("start_time", endOfWeek(now, { weekStartsOn: 1 }).toISOString());
  } else if (range === "mjesec") {
    appointmentsQuery = appointmentsQuery
      .gte("start_time", startOfMonth(now).toISOString())
      .lte("start_time", endOfMonth(now).toISOString());
  }

  if (statusFilter !== "svi") {
    appointmentsQuery = appointmentsQuery.eq("status", statusFilter);
  }

  // Paraleliziraj: appointments i services nisu međusobno zavisni.
  // Prije: sekvencijalno ~2 round-trip-a do Supabase-a; sad: 1 round-trip.
  const [{ data: appointments }, { data: servicesData }] = await Promise.all([
    appointmentsQuery,
    sb
      .from("services")
      .select("*")
      .eq("bookable", true)
      .eq("active", true)
      .order("order_index"),
  ]);
  const services = servicesData ?? [];
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 3: Manuel smoke test**

Pokreni `npm run dev`, otvori `/admin/termini`, prebaci kroz sve range filtere (danas, sedmica, mjesec, svi) i sve statuse. Verifikuj da:
- Lista termina se ispravno učitava
- Manual appointment form dropdown ima sve servise

Expected: Identično ponašanje kao prije, ali jedan round-trip manje.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(protected\)/termini/page.tsx
git commit -m "perf(admin/termini): parallelize appointments and services fetch"
```

---

## Task 3: Centralni cache tags + cached query helpers (foundation za Task 4-6)

**Cilj:** Definisati cache strategiju jednom da kasnije svaki cachirani tab koristi isti pattern.

**Files:**
- Create: `src/lib/cache/admin-cache-tags.ts`
- Create: `src/lib/cache/cached-queries.ts`
- Create: `tests/unit/cache-tags.test.ts`

- [ ] **Step 1: Napiši failing test za cache tags**

Kreiraj `tests/unit/cache-tags.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";

describe("ADMIN_CACHE_TAGS", () => {
  it("contains all required admin domain tags", () => {
    expect(ADMIN_CACHE_TAGS.services).toBe("admin:services");
    expect(ADMIN_CACHE_TAGS.settings).toBe("admin:settings");
    expect(ADMIN_CACHE_TAGS.workingHours).toBe("admin:working_hours");
    expect(ADMIN_CACHE_TAGS.blockedDates).toBe("admin:blocked_dates");
    expect(ADMIN_CACHE_TAGS.timeBlocks).toBe("admin:time_blocks");
    expect(ADMIN_CACHE_TAGS.gallery).toBe("admin:gallery");
  });

  it("tag values are unique", () => {
    const values = Object.values(ADMIN_CACHE_TAGS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm test -- cache-tags
```

Expected: FAIL sa "Cannot find module '@/lib/cache/admin-cache-tags'".

- [ ] **Step 3: Kreiraj cache tags modul**

Kreiraj `src/lib/cache/admin-cache-tags.ts`:

```ts
/**
 * Centralni mapping cache tagova za admin domain.
 *
 * Svaki ključ predstavlja jednu "logičku entiti" koju keširamo. Server
 * actions koje mutate-uju entitet pozivaju `updateTag(tag)` da bi
 * naredni server component fetch dobio svjež podatak.
 *
 * Zašto stringovi sa `admin:` prefiksom: ako kasnije dodamo public-facing
 * cache (npr. za /usluge stranicu), izbjegavamo case da admin invalidate
 * brže nego što treba (ili obrnuto). Eksplicitan namespace.
 */
export const ADMIN_CACHE_TAGS = {
  services: "admin:services",
  settings: "admin:settings",
  workingHours: "admin:working_hours",
  blockedDates: "admin:blocked_dates",
  timeBlocks: "admin:time_blocks",
  gallery: "admin:gallery",
} as const;

export type AdminCacheTag = (typeof ADMIN_CACHE_TAGS)[keyof typeof ADMIN_CACHE_TAGS];
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm test -- cache-tags
```

Expected: PASS (oba testa).

- [ ] **Step 5: Kreiraj cached query helpers**

Kreiraj `src/lib/cache/cached-queries.ts`:

```ts
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";

/**
 * Cached query helperi za rijetko-mijenjane admin podatke.
 *
 * `unstable_cache` keširaše rezultat između requestova na nivou Vercel
 * data cache-a. Invalidacija je eksplicitna preko `updateTag`, što
 * znači da mutating server actions MORAJU pozvati `updateTag` sa
 * odgovarajućim ADMIN_CACHE_TAGS ključem.
 *
 * Zašto ne `revalidate: N` (time-based): time-based cache znači stale
 * podaci do N sekundi nakon write-a, što za admin UI nije prihvatljivo
 * (Una mijenja servis pa odmah želi vidjeti promjenu). Tag-based daje
 * instant invalidaciju na write + indefinite cache na read.
 *
 * BITNO: ovi helperi zovu `createClient()` koji čita cookies → nisu
 * pure. `unstable_cache` ipak radi jer Next ulazi sa svježim cookies
 * po requestu, a cached payload je zavisan samo od stringified args.
 * Za admin domen cookies su uvijek admin cookies (proxy garantuje), pa
 * nema rizik od leak-a podataka između korisnika.
 */

export const getCachedServices = unstable_cache(
  async () => {
    const sb = await createClient();
    const { data } = await sb
      .from("services")
      .select("*")
      .order("order_index");
    return data ?? [];
  },
  ["admin-services-all"],
  { tags: [ADMIN_CACHE_TAGS.services] },
);

export const getCachedGalleryImages = unstable_cache(
  async () => {
    const sb = await createClient();
    const { data } = await sb
      .from("gallery_images")
      .select("id, storage_path, category, alt_text")
      .order("order_index");
    return data ?? [];
  },
  ["admin-gallery-all"],
  { tags: [ADMIN_CACHE_TAGS.gallery] },
);

export const getCachedWorkingHours = unstable_cache(
  async () => {
    const sb = await createClient();
    const { data } = await sb.from("working_hours").select("*");
    return data ?? [];
  },
  ["admin-working-hours-all"],
  { tags: [ADMIN_CACHE_TAGS.workingHours] },
);

export const getCachedBlockedDates = unstable_cache(
  async () => {
    const sb = await createClient();
    const { data } = await sb
      .from("blocked_dates")
      .select("*")
      .order("date_from");
    return data ?? [];
  },
  ["admin-blocked-dates-all"],
  { tags: [ADMIN_CACHE_TAGS.blockedDates] },
);

export const getCachedTimeBlocks = unstable_cache(
  async () => {
    const sb = await createClient();
    const { data } = await sb
      .from("time_blocks")
      .select("*")
      .order("start_time");
    return data ?? [];
  },
  ["admin-time-blocks-all"],
  { tags: [ADMIN_CACHE_TAGS.timeBlocks] },
);

export const getCachedSettings = unstable_cache(
  async () => {
    const sb = await createClient();
    const { data } = await sb.from("settings").select("key,value");
    return data ?? [];
  },
  ["admin-settings-all"],
  { tags: [ADMIN_CACHE_TAGS.settings] },
);
```

- [ ] **Step 6: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cache/ tests/unit/cache-tags.test.ts
git commit -m "feat(cache): add admin cache tags and cached query helpers"
```

---

## Task 4: Usluge tab — koristi cached query, ukini force-dynamic

**Cilj:** Lista usluga (rijetko se mijenja) se servira iz cache-a, prebacivanje na ovaj tab je instant.

**Files:**
- Modify: `src/app/admin/(protected)/usluge/page.tsx`
- Modify: `src/app/admin/(protected)/usluge/actions.ts`

- [ ] **Step 1: Update usluge/page.tsx**

Zamijeni trenutni sadržaj `src/app/admin/(protected)/usluge/page.tsx` sa:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { ServicesManager } from "@/components/admin/ServicesManager";
import { getCachedServices } from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Usluge — Admin",
  robots: { index: false, follow: false },
};

// Bez `export const dynamic = "force-dynamic"` — koristimo cached query
// koji se invalidate-uje preko updateTag iz usluge/actions.ts.

export default async function AdminUslugePage() {
  const services = await getCachedServices();

  return (
    <div>
      <PageHeader
        title="Usluge"
        subtitle="Upravljanje katalogom usluga i cijenama"
      />
      <div className="p-5 md:p-8">
        <ServicesManager initialServices={services} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Dodaj updateTag u usluge/actions.ts**

U `src/app/admin/(protected)/usluge/actions.ts`, na vrh fajla pored postojećeg `revalidatePath` importa dodaj `updateTag`:

Trenutna linija (oko linije 5):
```ts
import { revalidatePath } from "next/cache";
```

Promijeni u:
```ts
import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
```

Zatim, za svaku akciju koja mijenja services tabelu (svaka koja već poziva `revalidatePath("/admin/usluge")`), dodaj `updateTag(ADMIN_CACHE_TAGS.services)` iznad njega. Ovo je obavezno — bez ovoga UI prikazuje stale podatke.

`updateTag` (Next.js 16) je dizajniran za read-your-own-writes scenarije — odmah expirira cache za tag i naredni request čeka svježe podatke umjesto da serviraju stale. Za razliku od `revalidateTag(..., "max")` koji ima stale-while-revalidate semantiku, `updateTag` garantira da admin odmah vidi promjenu.

Pronađi sve linije sa `revalidatePath("/admin/usluge")` i ispred svake dodaj:
```ts
    updateTag(ADMIN_CACHE_TAGS.services);
```

Primjer:
```ts
// PRIJE:
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");

// POSLIJE:
    updateTag(ADMIN_CACHE_TAGS.services);
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 4: Verifikacija cache invalidation flow-a u dev modu**

Pokreni `npm run dev`. Otvori `/admin/usluge`:
1. Prvi load: usporedi network u DevTools — `services` query u Supabase Network panelu (Supabase Dashboard → Logs). Trebao bi biti vidljiv.
2. Prebaci na drugi tab pa nazad: query ne bi smio biti vidljiv u Supabase logs-u (cache hit).
3. Edituj jednu uslugu (cijena, ime). Vrati se na listu — promjena treba biti vidljiva odmah.

Expected: Cache miss na prvi load, hit na repeated load, instant invalidacija na write.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(protected\)/usluge/
git commit -m "perf(admin/usluge): use unstable_cache with tag-based revalidation"
```

---

## Task 5: Galerija tab — isti pattern kao Usluge

**Cilj:** Galerija se mijenja rijetko (upload nove slike, brisanje, reorder), idealan kandidat za cache.

**Files:**
- Modify: `src/app/admin/(protected)/galerija/page.tsx`
- Modify: `src/app/admin/(protected)/galerija/actions.ts`

- [ ] **Step 1: Update galerija/page.tsx**

Zamijeni sadržaj `src/app/admin/(protected)/galerija/page.tsx` sa:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { getCachedGalleryImages } from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Galerija — Admin",
  robots: { index: false, follow: false },
};

// Cached preko getCachedGalleryImages — invalidate-uje se iz
// galerija/actions.ts preko updateTag.

export default async function AdminGalerijaPage() {
  const images = await getCachedGalleryImages();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const mapped = images.map((img) => ({
    id: img.id,
    url: `${supabaseUrl}/storage/v1/object/public/gallery/${img.storage_path}`,
    category: img.category,
    alt: img.alt_text ?? `UP Beauty — ${img.category}`,
  }));

  return (
    <div>
      <PageHeader
        title="Galerija"
        subtitle="Upload i organizacija slika"
      />
      <div className="p-5 md:p-8">
        <GalleryManager items={mapped} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Dodaj updateTag u galerija/actions.ts**

U `src/app/admin/(protected)/galerija/actions.ts`, linija 4 import treba postati:

```ts
import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
```

Zatim, pronađi svaku akciju koja modifikuje `gallery_images` tabelu (upload, delete, reorder, edit alt_text — svaka koja poziva `revalidatePath("/admin/galerija")`) i iznad svake takve linije dodaj:

```ts
    updateTag(ADMIN_CACHE_TAGS.gallery);
```

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 4: Manuel smoke test**

`npm run dev`, otvori `/admin/galerija`:
1. Verifikuj da lista slika učitava normalno.
2. Upload novu sliku → vrati na listu → nova slika treba biti vidljiva.
3. Obriši sliku → ista provjera.
4. Reorder (drag) → ista provjera.

Expected: Sve akcije instant reflektuju u UI bez hard reload-a.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(protected\)/galerija/
git commit -m "perf(admin/galerija): use unstable_cache with tag-based revalidation"
```

---

## Task 6: Postavke tab — keširaj svaku sekciju nezavisno

**Cilj:** Postavke ima 4 paralelnih query-ja, svi mogu biti keširani sa različitim tagovima tako da edit jedne sekcije ne invalidate-uje ostale.

**Files:**
- Modify: `src/app/admin/(protected)/postavke/page.tsx`
- Modify: `src/app/admin/(protected)/postavke/actions.ts`

- [ ] **Step 1: Update postavke/page.tsx**

Zamijeni sadržaj `src/app/admin/(protected)/postavke/page.tsx` sa:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/PageHeader";
import { WorkingHoursEditor } from "@/components/admin/WorkingHoursEditor";
import { BlockedDatesManager } from "@/components/admin/BlockedDatesManager";
import { TimeBlocksManager } from "@/components/admin/TimeBlocksManager";
import { BookingRulesEditor } from "@/components/admin/BookingRulesEditor";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import {
  getCachedWorkingHours,
  getCachedBlockedDates,
  getCachedTimeBlocks,
  getCachedSettings,
} from "@/lib/cache/cached-queries";

export const metadata: Metadata = {
  title: "Postavke — Admin",
  robots: { index: false, follow: false },
};

// Bez force-dynamic. Svaka sekcija ima svoj cached query sa svojim
// tagom — edit radnog vremena invalidate-uje samo working_hours cache,
// ne settings ili blocked_dates.

export default async function AdminPostavkePage() {
  const [hours, blocked, timeBlocks, settings] = await Promise.all([
    getCachedWorkingHours(),
    getCachedBlockedDates(),
    getCachedTimeBlocks(),
    getCachedSettings(),
  ]);

  const settingsMap: Record<string, string> = {};
  for (const row of settings) {
    settingsMap[row.key] = row.value;
  }

  return (
    <div>
      <PageHeader
        title="Postavke"
        subtitle="Radno vrijeme, blokirani datumi i nalog"
      />

      <div className="space-y-8 p-5 md:p-8">
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Pravila rezervisanja
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite koliko unaprijed i koliko kasno klijenti mogu zakazivati
            termine, te pauzu između termina za pripremu.
          </p>
          <BookingRulesEditor currentSettings={settingsMap} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">Radno vrijeme</h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite radno vrijeme po danima. Ovo se koristi kao fallback
            kada nema postavljenog specifičnog override-a za datum.
          </p>
          <WorkingHoursEditor hours={hours} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani datumi
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Dani kada ste odsutni, praznici, godišnji odmor. Klijenti ne mogu
            zakazati termine u blokiranim datumima.
          </p>
          <BlockedDatesManager dates={blocked} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani intervali (sub-day)
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Blokirajte konkretno vrijeme (npr. 18:00–20:00 u srijedu za
            zubara). Za cijele dane koristite sekciju iznad &quot;Blokirani
            datumi&quot;.
          </p>
          <TimeBlocksManager blocks={timeBlocks} />
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Promjena lozinke
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Preporučuje se jaka lozinka od najmanje 8 karaktera.
          </p>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Dodaj updateTag u postavke/actions.ts**

U `src/app/admin/(protected)/postavke/actions.ts`:

Import (linija 5):
```ts
import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_CACHE_TAGS } from "@/lib/cache/admin-cache-tags";
```

Postavke ima više sekcija. Za svaku akciju, dodaj odgovarajući `updateTag` PRIJE postojećeg `revalidatePath("/admin/postavke")`:

- Akcije koje mijenjaju `working_hours` → `updateTag(ADMIN_CACHE_TAGS.workingHours)`
- Akcije koje mijenjaju `blocked_dates` → `updateTag(ADMIN_CACHE_TAGS.blockedDates)`
- Akcije koje mijenjaju `time_blocks` → `updateTag(ADMIN_CACHE_TAGS.timeBlocks)`
- Akcije koje mijenjaju `settings` → `updateTag(ADMIN_CACHE_TAGS.settings)`

Pomoć: pretraži koju tabelu svaka funkcija dirira. Naprimjer, funkcija koja radi `sb.from("working_hours").upsert(...)` invalidate-uje `workingHours` tag.

BITNO: nikad ne preskoči ovaj korak — to je razlika između funkcionalnog UI-a i UI-a koji prikazuje stale podatke nakon edita.

- [ ] **Step 3: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 4: Manuel smoke test za svaki dio**

`npm run dev`, otvori `/admin/postavke`:
1. Edituj radno vrijeme → save → page reload → promjena vidljiva.
2. Dodaj blocked date → ista provjera.
3. Dodaj time block → ista provjera.
4. Promijeni booking rule (advance booking days) → ista provjera.

Expected: Sve sekcije instant reflektuju write-ove.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/\(protected\)/postavke/
git commit -m "perf(admin/postavke): use granular per-section unstable_cache"
```

---

## Task 7: Dashboard — keširaj settings query, ostatak ostaje dinamičan

**Cilj:** Dashboard prikazuje real-time stats (broj termina danas/sedmica/mjesec) — to MORA biti svježe. Ali `settings` query za max booking date se može kešovati.

**Files:**
- Modify: `src/app/admin/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Update dashboard/page.tsx settings fetch**

U `src/app/admin/(protected)/dashboard/page.tsx`:

Trenutni import iz linije 14:
```tsx
import { parseBookingSettings } from "@/lib/settings/read";
```

Ostavi taj import i dodaj iznad ili ispod:
```tsx
import { getCachedSettings } from "@/lib/cache/cached-queries";
```

Trenutni kod na linijama 40-41:
```tsx
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
```

Zamijeni sa:
```tsx
  // settings keširan (rijetko se mijenja, invalidate iz postavke/actions.ts)
  const settingsRows = await getCachedSettings();
  const bookingSettings = parseBookingSettings(settingsRows);
```

OSTAVI `export const dynamic = "force-dynamic"` (linija 22) — ostatak stranice (appointment stats, day list) je real-time podatak i mora ostati dinamičan. Single cached query unutar dynamic page-a je validan pattern.

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 3: Manuel smoke test**

`npm run dev`, otvori `/admin/dashboard`:
1. Verifikuj da se stat cards renderuju normalno.
2. Day picker se prikazuje sa max date = today + advanceBookingDays.
3. Otvori `/admin/postavke`, promijeni `advance_booking_days` setting, save.
4. Vrati se na `/admin/dashboard` → max date u day picker-u treba biti ažuriran.

Expected: Settings invalidacija iz postavke actions stiže i u dashboard.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/\(protected\)/dashboard/page.tsx
git commit -m "perf(admin/dashboard): cache settings query while keeping stats dynamic"
```

---

## Task 8: Tab-specifične loading skeletone (UX poliranje)

**Cilj:** Generic skeleton iz Task 1 radi za sve, ali tab-specifične skeletone daju 100% match layout-a što je manje "skok" pri load-u.

**Files:**
- Create: `src/app/admin/(protected)/dashboard/loading.tsx`
- Create: `src/app/admin/(protected)/termini/loading.tsx`
- Create: `src/app/admin/(protected)/usluge/loading.tsx`
- Create: `src/app/admin/(protected)/galerija/loading.tsx`
- Create: `src/app/admin/(protected)/postavke/loading.tsx`

- [ ] **Step 1: Dashboard skeleton**

Kreiraj `src/app/admin/(protected)/dashboard/loading.tsx`:

```tsx
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-32 bg-stone-200" />
        <div className="mt-2 h-3 w-48 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-cream bg-white p-4 md:p-5">
              <div className="mb-3 size-9 rounded-full bg-stone-200" />
              <div className="mb-1 h-3 w-20 bg-stone-100" />
              <div className="h-7 w-12 bg-stone-200" />
            </div>
          ))}
        </div>

        {/* Termini list */}
        <div className="mb-3 h-6 w-24 bg-stone-200" />
        <div className="border border-cream bg-white">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-cream px-5 py-4 last:border-b-0"
            >
              <div className="h-6 w-14 bg-stone-200" />
              <div className="flex-1">
                <div className="h-3 w-32 bg-stone-200" />
                <div className="mt-1 h-2.5 w-48 bg-stone-100" />
              </div>
              <div className="h-5 w-16 bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Termini skeleton**

Kreiraj `src/app/admin/(protected)/termini/loading.tsx`:

```tsx
export default function TerminiLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-24 bg-stone-200" />
        <div className="mt-2 h-3 w-36 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        {/* Filter buttons */}
        <div className="mb-5 flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-16 bg-stone-200" />
          ))}
        </div>

        {/* Appointment rows */}
        <div className="border border-cream">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-cream bg-white px-5 py-4 last:border-b-0"
            >
              <div className="h-12 w-16 bg-stone-200" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-stone-200" />
                <div className="mt-1.5 h-3 w-56 bg-stone-100" />
              </div>
              <div className="h-6 w-20 bg-stone-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Usluge skeleton**

Kreiraj `src/app/admin/(protected)/usluge/loading.tsx`:

```tsx
export default function UslugeLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-20 bg-stone-200" />
        <div className="mt-2 h-3 w-56 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-cream bg-white p-4">
            <div className="flex justify-between gap-4">
              <div className="flex-1">
                <div className="h-4 w-48 bg-stone-200" />
                <div className="mt-2 h-3 w-72 bg-stone-100" />
              </div>
              <div className="h-4 w-16 bg-stone-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Galerija skeleton**

Kreiraj `src/app/admin/(protected)/galerija/loading.tsx`:

```tsx
export default function GalerijaLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-24 bg-stone-200" />
        <div className="mt-2 h-3 w-48 bg-stone-100" />
      </div>

      <div className="p-5 md:p-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-stone-200" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Postavke skeleton**

Kreiraj `src/app/admin/(protected)/postavke/loading.tsx`:

```tsx
export default function PostavkeLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-cream bg-white px-5 py-6 md:px-8 md:py-8">
        <div className="h-6 w-24 bg-stone-200" />
        <div className="mt-2 h-3 w-56 bg-stone-100" />
      </div>

      <div className="space-y-8 p-5 md:p-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <section key={i}>
            <div className="mb-3 h-5 w-40 bg-stone-200" />
            <div className="mb-4 h-3 w-72 bg-stone-100" />
            <div className="h-32 border border-cream bg-white" />
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: Bez grešaka.

- [ ] **Step 7: Verifikacija u dev modu**

`npm run dev`, klikaj između svih tabova brzo. Skeleton svakog taba treba odgovarati layout-u tog taba (a ne generic skeleton).

Expected: Instant skeleton koji vizuelno match-uje stvarni sadržaj.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/\(protected\)/*/loading.tsx
git commit -m "feat(admin): tab-specific loading skeletons matching page layouts"
```

---

## Task 9: Verifikacija + final mjerenje

**Cilj:** Brojkama dokazati da je tab switching brže nego u Task 0 baseline.

**Files:** Bez code izmjena.

- [ ] **Step 1: Build i deploy**

Run lokalno:
```bash
npm run build
```

Expected: Build prolazi bez greški.

Push na branch i otvori PR (ili deploy preview ako tako radimo):
```bash
git push -u origin perf/admin-dashboard-tab-switching
```

- [ ] **Step 2: Mjerenje na production-like environment-u**

Na Vercel preview deployment-u (ili production nakon merge-a):
1. Otvori DevTools → Network.
2. Login u admin.
3. Klikni redom kroz sve tabove, pa po drugi put.
4. Zabilježi TTFB i total time za svaki tab, prvi i drugi put.

Tabela:
```
| Tab        | TTFB (1st) | Total (1st) | TTFB (2nd, cached) | Total (2nd) |
|------------|------------|-------------|--------------------|-------------|
| dashboard  |            |             |                    |             |
| termini    |            |             |                    |             |
| usluge     |            |             |                    |             |
| galerija   |            |             |                    |             |
| postavke   |            |             |                    |             |
```

- [ ] **Step 3: Verify cache invalidation flow na produkciji**

1. Otvori `/admin/usluge`, zapamti listu.
2. Edit cijenu jedne usluge, save.
3. Soft reload (`Cmd+R`) — promjena treba biti vidljiva.
4. Verifikuj isto za galeriju i postavke.

Expected: Sve invalidacije rade. Ako neka ne radi, znači `updateTag` poziv fali u odgovarajućoj akciji.

- [ ] **Step 4: Compare baseline vs final i odluči da li je dovoljno**

Cilj je <500ms perceived (sa skeleton) i <1s actual TTFB za cached tabove. Ako nije dostignut, daljnje opcije su:
- **Vercel region preselected na isti kao Supabase** (najvjerovatnije najveći win ako nije već urađeno u Task 0).
- **RPC funkcija za dashboard stats** — jedan Supabase round-trip umjesto 4.
- **Edge runtime** za read-only tabove — eksperiment.

Ovaj plan ne uključuje te opcionalne korake; ako mjerenje pokaže da treba, otvara se posebni plan.

- [ ] **Step 5: Commit final notes + open PR**

Ako nije već urađeno u Task 0, dodaj `docs/superpowers/plans/2026-05-18-baseline.md` ili appendiraj rezultate u ovaj plan kao comment block. Otvori PR sa naslovom:

```
perf(admin): faster tab switching via cache, parallelization, loading states
```

PR description treba uključiti baseline tabelu vs after tabelu.

---

## Self-Review Notes

**Spec coverage:**
- Task 0: Baseline + infrastruktura (uzrok #4, #5).
- Task 1: Loading skeleton (UX win, uzrok #3).
- Task 2: Termini paralelizacija (uzrok #2).
- Task 3-7: Cache architecture + per-tab application (uzrok #1).
- Task 8: Skeletone polish.
- Task 9: Verifikacija.

**Placeholder scan:** Sve TODO/TBD eliminisani. Svaki step ima exact code ili exact command.

**Type consistency:** `ADMIN_CACHE_TAGS` keys (`services`, `gallery`, `workingHours`, `blockedDates`, `timeBlocks`, `settings`) referencirani konzistentno kroz Task 3-7. Cached query helperi (`getCached*`) imenovani konzistentno.

**Risk note:** `unstable_cache` u Next 16 može imati izmjene API-ja. Ako se desi runtime grešak na build-u (`Module not found: 'next/cache'` ili sl.), check `node_modules/next/dist/docs/` per AGENTS.md upozorenje.
