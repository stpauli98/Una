# Postavke Collapsible Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformisati svih 7 sekcija u `/admin/postavke` u collapsible drop-down panele tako da je default state samo naslov + kratak opis + (opciono) "zadnje izmijenjeno" meta info — sadržaj editor-a se vidi tek kad korisnik klikne na sekciju.

**Architecture:** Reusable `CollapsibleSection` server-komponent koji omotava native HTML `<details>` + `<summary>` (zero-JS, ARIA built-in, screen reader friendly). Chevron ikona rotira se preko Tailwind v4 `group-open:` variant — bez `useState`, ostaje server component, nema dodatnog client bundle-a. Sve sekcije collapsed po default-u; native `<details>` zadržava open state preko `router.refresh()` (DOM stanje preživi React reconciliation), pa "edit pa refresh" UX radi prirodno bez cookie persistence-a.

**Tech Stack:** Next.js 16 App Router (server komponenta), Tailwind CSS v4 (`group-open:` variant), lucide-react (`ChevronDown`), Vitest + @testing-library/react za component test.

---

## File Structure

**Create:**
- `src/components/admin/CollapsibleSection.tsx` — reusable server komponent
- `tests/unit/collapsible-section.test.tsx` — RTL test za strukturu i open/closed behavior

**Modify:**
- `src/app/admin/(protected)/postavke/page.tsx` — zamijeni 7 `<section>` blokova sa `<CollapsibleSection>`; postojeća `SectionMeta` helper komponenta ostaje, samo se sad prosljeđuje kao `meta` prop

**Ne mijenjamo:**
- Nijedan postojeći editor komponent (`BookingRulesEditor`, `WorkingHoursEditor`, `BlockedDatesManager`, `TimeBlocksManager`, `PushNotificationToggle`, `CsvExportButton`, `ChangePasswordForm`) — oni samo postaju children unutar collapsible-a
- `SectionMeta` (lokalna helper funkcija u page.tsx) — ostaje gdje jest

---

## Design — Vizuelna referenca

**Collapsed (default):**
```
┌─────────────────────────────────────────────────┐
│ Pravila rezervisanja                       ▾  │
│ Podesite koliko unaprijed klijenti mogu...     │
│ ZADNJE IZMIJENJENO: 22.05.2026. 14:30          │
└─────────────────────────────────────────────────┘
```

**Open (poslije klika):**
```
┌─────────────────────────────────────────────────┐
│ Pravila rezervisanja                       ▴  │  ← chevron rotira
│ Podesite koliko unaprijed klijenti mogu...     │
│ ZADNJE IZMIJENJENO: 22.05.2026. 14:30          │
├─────────────────────────────────────────────────┤
│  [BookingRulesEditor render]                   │
└─────────────────────────────────────────────────┘
```

Pristupačnost:
- Native `<details>` ima ugrađen `role="group"` + `aria-expanded` na `<summary>` (browser default)
- Keyboard: Tab fokusira summary, Enter/Space toggles
- Screen reader najavljuje "expanded"/"collapsed" automatski

---

## Task 1: Branch + failing test za `CollapsibleSection`

**Files:**
- Create: `tests/unit/collapsible-section.test.tsx`

- [ ] **Step 0: Kreirati feature branch sa main-a**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git checkout main && git pull origin main && git checkout -b feat/postavke-collapsible
```

Expected: `Switched to a new branch 'feat/postavke-collapsible'`. Sav daljnji rad ide na ovu branch.

- [ ] **Step 1: Napisati failing test**

Kreiraj `tests/unit/collapsible-section.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renderuje title i description uvijek (i kad je collapsed)", () => {
    render(
      <CollapsibleSection
        title="Pravila rezervisanja"
        description="Podesite koliko unaprijed..."
      >
        <div>Editor content</div>
      </CollapsibleSection>,
    );
    expect(
      screen.getByRole("heading", { name: "Pravila rezervisanja" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Podesite koliko/)).toBeInTheDocument();
  });

  it("renderuje children u DOM-u (native details drži open state)", () => {
    render(
      <CollapsibleSection title="X" description="Y">
        <div data-testid="editor-body">Editor</div>
      </CollapsibleSection>,
    );
    // Native <details> uvijek drži children u DOM-u; CSS kontroliše vidljivost.
    expect(screen.getByTestId("editor-body")).toBeInTheDocument();
  });

  it("renderuje meta slot ako je prosljeđen", () => {
    render(
      <CollapsibleSection
        title="X"
        description="Y"
        meta={<p data-testid="meta">Zadnje: 22.05.2026.</p>}
      >
        <div>Editor</div>
      </CollapsibleSection>,
    );
    expect(screen.getByTestId("meta")).toBeInTheDocument();
  });

  it("default je collapsed (details bez open atributa)", () => {
    const { container } = render(
      <CollapsibleSection title="X" description="Y">
        <div>Editor</div>
      </CollapsibleSection>,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.hasAttribute("open")).toBe(false);
  });

  it("defaultOpen=true postavlja open atribut", () => {
    const { container } = render(
      <CollapsibleSection title="X" description="Y" defaultOpen>
        <div>Editor</div>
      </CollapsibleSection>,
    );
    const details = container.querySelector("details");
    expect(details!.hasAttribute("open")).toBe(true);
  });
});
```

- [ ] **Step 2: Pokrenuti test — mora pasti (komponent ne postoji)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/collapsible-section.test.tsx
```

Expected: FAIL sa `Failed to load module ... CollapsibleSection`.

---

## Task 2: Implementirati `CollapsibleSection` komponent

**Files:**
- Create: `src/components/admin/CollapsibleSection.tsx`

- [ ] **Step 1: Kreirati komponent fajl**

Sadržaj:

```tsx
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  /** Naslov sekcije (renderuje se kao h2 u summary-ju). */
  title: string;
  /** Kratak opis koji se vidi i kad je sekcija zatvorena. */
  description: string;
  /**
   * Opcioni meta JSX (npr. SectionMeta "Zadnje izmijenjeno") —
   * renderuje se ispod opisa, vidljiv u oba stanja.
   */
  meta?: ReactNode;
  /** Sadržaj koji se otkriva tek na klik. */
  children: ReactNode;
  /** Da li je default state open. Default false. */
  defaultOpen?: boolean;
};

/**
 * Collapsible sekcija za admin Postavke. Koristi native HTML <details>
 * + <summary> tako da:
 *   - ARIA expanded/collapsed automatski (screen reader friendly)
 *   - Tab/Enter/Space keyboard nav radi bez koda
 *   - Server komponent (nema useState, nula client JS-a)
 *   - Open state preživi router.refresh() (DOM zadržava `open` atribut
 *     kroz React reconciliation)
 *
 * Chevron rotacija preko Tailwind v4 `group-open:` variant —
 * `<details>` ima `group` klasu, ChevronDown ima
 * `group-open:rotate-180` koja se aktivira kad parent ima `open` atribut.
 *
 * `summary::-webkit-details-marker { display: none }` skida default
 * triangle browser marker — nadomještamo ga custom chevron-om.
 */
export function CollapsibleSection({
  title,
  description,
  meta,
  children,
  defaultOpen = false,
}: Props) {
  return (
    <details
      open={defaultOpen}
      className="group border border-cream bg-white"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 transition-colors hover:bg-warm focus-visible:bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose [&::-webkit-details-marker]:hidden">
        <div className="flex-1">
          <h2 className="mb-1 font-display text-xl text-dark">{title}</h2>
          <p className="text-[12px] text-light">{description}</p>
          {meta}
        </div>
        <ChevronDown
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-light transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-cream p-5">{children}</div>
    </details>
  );
}
```

- [ ] **Step 2: Pokrenuti test — mora proći**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/collapsible-section.test.tsx
```

Expected: 5/5 tests pass.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Expected: bez grešaka.

- [ ] **Step 4: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/components/admin/CollapsibleSection.tsx tests/unit/collapsible-section.test.tsx && git commit -m "feat(admin): add CollapsibleSection component for Postavke drop-down sections"
```

---

## Task 3: Refactor BookingRules sekcije kao proof-of-concept

**Files:**
- Modify: `src/app/admin/(protected)/postavke/page.tsx` (samo BookingRulesEditor sekcija)

- [ ] **Step 1: Dodati import**

Otvori `src/app/admin/(protected)/postavke/page.tsx`. Postojeća lista import-ova završava sa nečim sličnim:

```tsx
import { CsvExportButton } from "@/components/admin/CsvExportButton";
import {
  getCachedWorkingHours,
  ...
} from "@/lib/cache/cached-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/utils/tz";
import { formatShortDate, formatTime } from "@/lib/utils/format";
```

Dodati ispod ovih import-ova:

```tsx
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";
```

- [ ] **Step 2: Zamijeniti BookingRules sekciju**

Pronaći postojeći blok (oko 47-58 linije, prva sekcija u return-u):

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Pravila rezervisanja
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite koliko unaprijed i koliko kasno klijenti mogu zakazivati
            termine, te pauzu između termina za pripremu.
          </p>
          <SectionMeta
            label="Zadnje izmijenjeno"
            timestamp={bookingRulesLastUpdated}
          />
          <BookingRulesEditor currentSettings={settingsMap} />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Pravila rezervisanja"
          description="Podesite koliko unaprijed i koliko kasno klijenti mogu zakazivati termine, te pauzu između termina za pripremu."
          meta={
            <SectionMeta
              label="Zadnje izmijenjeno"
              timestamp={bookingRulesLastUpdated}
            />
          }
        >
          <BookingRulesEditor currentSettings={settingsMap} />
        </CollapsibleSection>
```

- [ ] **Step 3: Typecheck + ručna provjera renderovanja**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Expected: bez grešaka.

Pokreni dev server (`npm run dev`), otvori `/admin/postavke`. Očekivano:
- "Pravila rezervisanja" sekcija pokazuje samo naslov + opis + "Zadnje izmijenjeno"
- Chevron ▾ desno
- Klik na bilo gdje na header-u proširuje, sadržaj BookingRulesEditor-a se prikazuje
- Chevron se rotira na ▴

Ostale sekcije i dalje izgledaju kao prije (još nisu refaktorisane).

- [ ] **Step 4: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/app/admin/\(protected\)/postavke/page.tsx && git commit -m "refactor(admin/postavke): convert Pravila rezervisanja to CollapsibleSection (POC)"
```

---

## Task 4: Refactor preostalih 6 sekcija

**Files:**
- Modify: `src/app/admin/(protected)/postavke/page.tsx` (preostalih 6 `<section>` blokova)

- [ ] **Step 1: Zamijeniti "Radno vrijeme" sekciju**

Pronaći:

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">Radno vrijeme</h2>
          <p className="mb-4 text-[12px] text-light">
            Podesite radno vrijeme po danima. Ovo se koristi kao fallback
            kada nema postavljenog specifičnog override-a za datum.
          </p>
          <WorkingHoursEditor hours={hours} />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Radno vrijeme"
          description="Podesite radno vrijeme po danima. Ovo se koristi kao fallback kada nema postavljenog specifičnog override-a za datum."
        >
          <WorkingHoursEditor hours={hours} />
        </CollapsibleSection>
```

- [ ] **Step 2: Zamijeniti "Blokirani datumi" sekciju**

Pronaći:

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani datumi
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Dani kada ste odsutni, praznici, godišnji odmor. Klijenti ne mogu
            zakazati termine u blokiranim datumima.
          </p>
          <SectionMeta
            label="Zadnje dodato"
            timestamp={blockedDatesLastAdded}
          />
          <BlockedDatesManager dates={blocked} />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Blokirani datumi"
          description="Dani kada ste odsutni, praznici, godišnji odmor. Klijenti ne mogu zakazati termine u blokiranim datumima."
          meta={
            <SectionMeta
              label="Zadnje dodato"
              timestamp={blockedDatesLastAdded}
            />
          }
        >
          <BlockedDatesManager dates={blocked} />
        </CollapsibleSection>
```

- [ ] **Step 3: Zamijeniti "Blokirani intervali" sekciju**

Pronaći:

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Blokirani intervali (sub-day)
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Blokirajte konkretno vrijeme (npr. 18:00–20:00 u srijedu za
            zubara). Za cijele dane koristite sekciju iznad &quot;Blokirani
            datumi&quot;.
          </p>
          <SectionMeta
            label="Zadnje dodato"
            timestamp={timeBlocksLastAdded}
          />
          <TimeBlocksManager blocks={timeBlocks} />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Blokirani intervali (sub-day)"
          description='Blokirajte konkretno vrijeme (npr. 18:00–20:00 u srijedu za zubara). Za cijele dane koristite sekciju iznad "Blokirani datumi".'
          meta={
            <SectionMeta
              label="Zadnje dodato"
              timestamp={timeBlocksLastAdded}
            />
          }
        >
          <TimeBlocksManager blocks={timeBlocks} />
        </CollapsibleSection>
```

- [ ] **Step 4: Zamijeniti "Obavještenja na uređaju" sekciju**

Pronaći:

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Obavještenja na uređaju
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Uključi push notifikacije da dobiješ obavještenje čim
            klijent zakaže termin — čak i kad admin panel nije
            otvoren. Najbolje radi kao instalirana PWA (UP Admin) na
            telefon.
          </p>
          <PushNotificationToggle />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Obavještenja na uređaju"
          description="Uključi push notifikacije da dobiješ obavještenje čim klijent zakaže termin — čak i kad admin panel nije otvoren. Najbolje radi kao instalirana PWA (UP Admin) na telefon."
        >
          <PushNotificationToggle />
        </CollapsibleSection>
```

- [ ] **Step 5: Zamijeniti "Export podataka" sekciju**

Pronaći:

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Export podataka
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Preuzmi sve termine u CSV formatu za backup ili porezni izvještaj.
            Otvara se u Excel-u i LibreOffice Calc-u (semicolon separator,
            UTF-8 sa BOM-om).
          </p>
          <CsvExportButton availableYears={exportYears} />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Export podataka"
          description="Preuzmi sve termine u CSV formatu za backup ili porezni izvještaj. Otvara se u Excel-u i LibreOffice Calc-u (semicolon separator, UTF-8 sa BOM-om)."
        >
          <CsvExportButton availableYears={exportYears} />
        </CollapsibleSection>
```

- [ ] **Step 6: Zamijeniti "Promjena lozinke" sekciju**

Pronaći:

```tsx
        <section>
          <h2 className="mb-3 font-display text-xl text-dark">
            Promjena lozinke
          </h2>
          <p className="mb-4 text-[12px] text-light">
            Preporučuje se jaka lozinka od najmanje 8 karaktera.
          </p>
          <ChangePasswordForm />
        </section>
```

Zamijeniti sa:

```tsx
        <CollapsibleSection
          title="Promjena lozinke"
          description="Preporučuje se jaka lozinka od najmanje 8 karaktera."
        >
          <ChangePasswordForm />
        </CollapsibleSection>
```

- [ ] **Step 7: Verifikovati da nema preostalih `<section>` blokova**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -c '<section>' src/app/admin/\(protected\)/postavke/page.tsx
```

Expected: `0` (svih 7 sekcija refaktorisano).

- [ ] **Step 8: Typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Expected: bez grešaka.

- [ ] **Step 9: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/app/admin/\(protected\)/postavke/page.tsx && git commit -m "refactor(admin/postavke): convert remaining 6 sections to CollapsibleSection"
```

---

## Task 5: Verify + Push + PR

**Files:** (read only)

- [ ] **Step 1: Pun unit test suite**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test
```

Expected: svi prethodni testovi i dalje prolaze + 5 novih `collapsible-section.test.tsx` testova. Ukupno baseline + 5.

- [ ] **Step 2: Production build (uključuje typecheck)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run build
```

Expected: build prolazi. Provjeriti da `/admin/postavke` ruta i dalje generiše kao server komponent (vidi log "Server Component" ili statičku stranu).

- [ ] **Step 3: Manual smoke (dev server)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run dev
```

Otvoriti `/admin/postavke`, verifikovati:
- Sve 7 sekcija pokazuju samo title + description + meta (gdje postoji)
- Klik na header proširuje, sadržaj se ukazuje
- Chevron rotira na klik
- Tab navigation: fokus prelazi sa summary na summary
- Enter/Space toggluju otvorenu sekciju
- Više sekcija može biti otvoreno istovremeno
- Edit u BookingRulesEditor → sekcija ostaje otvorena nakon `router.refresh()` (test: izmijeniti pravilo, observ da sekcija ostaje otvorena dok se "Zadnje izmijenjeno" timestamp ažurira)

- [ ] **Step 4: Push branch**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git push -u origin feat/postavke-collapsible
```

- [ ] **Step 5: Kreirati PR**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && gh pr create --base main --head feat/postavke-collapsible --title "feat(admin/postavke): collapsible drop-down sekcije za bolju preglednost" --body "$(cat <<'EOF'
## Summary

Postavke je imao 7 sekcija direktno renderovanih full-height — strana je rasla i admin morao mnogo skrolati. Sada je sve collapsed po default-u; admin vidi naslov + opis + (gdje postoji) 'Zadnje izmijenjeno' timestamp. Klikom na sekciju proširuje detalje.

## Implementacija

- Novi \`CollapsibleSection\` server komponent koristi native HTML \`<details>\` + \`<summary>\` — zero client JS, ARIA expanded/collapsed built-in, keyboard nav (Tab/Enter/Space) radi bez koda.
- Chevron rotacija preko Tailwind v4 \`group-open:\` variant — bez \`useState\`.
- Otvoreno stanje preživi \`router.refresh()\` (DOM zadržava \`open\` atribut), pa 'edit pa observ refresh' UX radi prirodno bez cookie persistence-a.
- Više sekcija može biti otvoreno istovremeno (svaka nezavisna).

## Promjene

- \`src/components/admin/CollapsibleSection.tsx\` (novi, ~50 LoC)
- \`tests/unit/collapsible-section.test.tsx\` (novi, 5 RTL testova)
- \`src/app/admin/(protected)/postavke/page.tsx\` — sve 7 \`<section>\` zamijenjeno sa \`<CollapsibleSection>\`

## Test plan

- [x] \`npm test\` — svi prethodni + 5 novih testovi
- [x] \`npm run typecheck\` — clean
- [x] \`npm run build\` — clean
- [ ] Manual smoke: 7 sekcija collapsed, klik otvara, chevron rotira, keyboard nav radi, otvoreno stanje preživi izmjenu+revalidate
EOF
)"
```

- [ ] **Step 6: Verifikovati PR i njegove checks**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && gh pr view --json url,mergeable --jq '"\(.url) [\(.mergeable)]"'
```

---

## Out of scope (za odvojen razgovor)

- **Persist open state preko sesije** (cookie tipa `up-admin-postavke-open: ["rules","blocked-dates"]`) — admin koji vraća sutra vidi iste otvorene sekcije. Za sad svaki page load počinje sa svim collapsed. Niska prioritet jer UX i bez ovog radi (DOM state preživi unutar sesije).
- **Accordion mode** (samo 1 sekcija otvorena u trenutku) — preferirano je multi-open jer admin možda hoće da uporedi npr. Blokirane datume sa Blokiranim intervalima. Ako se javi feedback "previše buke", može se razmotriti accordion sa toggle prečicom.
- **Auto-expand na fresh visit** (npr. PushNotification ostaje otvoren prvi put da admin vidi da postoji) — nije nepohodno; admin lako otkrije čekiranjem.

---

## Self-Review (pre execute-a)

**Spec coverage:**
- Naslov + opis vidljiv u collapsed state ✓ (CollapsibleSection summary)
- Detalji vidljivi tek nakon klika ✓ (children u details body)
- Sve 7 sekcija ✓ (Task 3 + Task 4)
- "Zadnje izmijenjeno" meta vidljiv u summary ✓ (meta prop)

**Placeholder scan:** Nema TODO/TBD. Svaka komanda i svaki blok koda eksplicitan.

**Type consistency:** `CollapsibleSection` props (`title`, `description`, `meta`, `children`, `defaultOpen`) konzistentni kroz sve 7 poziva u page.tsx i u testu.

**Branch convention:** Task 5 koristi `feat/postavke-collapsible` — predloženo ime. Task 1 ne zove `git checkout -b` eksplicitno; **dodati ovo na početak Task 1 da bi se sav rad odradio na branch-u, ne na main-u.**
