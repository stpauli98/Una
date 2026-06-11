# Unit testovi — Vitest

**390 testova / 39 fajlova** u `tests/unit/` (verifikovano `npm test` run-om 2026-06-10). Pokrivaju pure logiku.

## Config

**Fajl:** `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

| Opcija | Vrijednost | Razlog |
|--------|-----------|--------|
| `environment: "jsdom"` | DOM | Za React komponente |
| `globals: true` | Globalni `describe`, `it`, `expect` | Manje import-a |
| `setupFiles` | `tests/setup.ts` | Mock-ovi |
| `include` | `tests/unit/**` | Samo unit, ne e2e |
| `alias` | `@` → `./src` | Isti kao tsconfig |

## Lista test fajlova

Brojevi iz `npx vitest list` (2026-06-10):

| Fajl | Testova | Šta pokriva |
|------|---------|-------------|
| `availability.test.ts` | 30 | `computeAvailableSlots()` algoritam |
| `day-bounds.test.ts` | 30 | Day/week/month boundary helperi (DST-safe) |
| `admin-prefs.test.ts` | 29 | Local prefs serialize/restore |
| `phone.test.ts` | 26 | Phone normalization (BA + intl) |
| `services-schema.test.ts` | 25 | Zod service schema |
| `services-jsonld.test.ts` | 19 | `buildServicesJsonLd()` |
| `booking-schemas.test.ts` | 19 | Booking form + manual schemas |
| `notifications/templates.test.ts` | 15 | Email HTML šabloni |
| `format.test.ts` | 13 | Date, time, price formatting |
| `rate-limit.test.ts` | 11 | Rate limiter + IP detection |
| `csv.test.ts` | 11 | CSV export builder (separator, BOM, escaping) |
| `wa.test.ts` | 10 | WhatsApp link generator |
| `validate-slot.test.ts` | 10 | Server-side slot validacija |
| `safe-redirect.test.ts` | 10 | Open redirect protection |
| `wa-messages.test.ts` | 9 | Status-adaptive messages |
| `site-url.test.ts` | 9 | URL normalization |
| `log.test.ts` | 9 | PII sanitizacija u logovima |
| `grid.test.ts` | 9 | `isGridAligned()`, grid validacija |
| `gallery-categories.test.ts` | 9 | Kategorije galerije |
| `notifications/ics.test.ts` | 8 | `.ics` kalendar generator |
| `breadcrumbs-jsonld.test.ts` | 8 | `buildBreadcrumbsJsonLd()` |
| `termini-filters.test.ts` | 6 | Filter logika |
| `tz.test.ts` | 5 | Sarajevo TZ helperi |
| `status-counts.test.ts` | 5 | Brojanje po statusu |
| `rules.test.ts` | 5 | `getHoursForDay()`, hours map |
| `recurring-blocks.test.ts` | 5 | Weekly recurrence expansion |
| `notifications/send-admin-email.test.ts` | 5 | Admin email slanje |
| `collapsible-section.test.tsx` | 5 | CollapsibleSection komponenta |
| `admin-emails.test.ts` | 5 | `isAdminEmail()` |
| `termini-status-filter-url.test.ts` | 4 | URL param filter |
| `settings.test.ts` | 4 | `parseBookingSettings()` fallback |
| `month-availability.test.ts` | 4 | Month-level availability |
| `group-by-day.test.ts` | 4 | Grupisanje po danu |
| `notifications/send-client-email.test.ts` | 3 | Confirmation email |
| `notifications/send-cancellation-email.test.ts` | 3 | Cancel email |
| `notifications/send-booking-received-email.test.ts` | 3 | "Primljeno" email |
| `push-payload.test.ts` | 2 | Push notification payload |
| `cache-tags.test.ts` | 2 | Cache tag generation |
| `smoke.test.ts` | 1 | Smoke test |

**Ukupno: 390**

## Konvencije

### Imenovanje

```
src/lib/booking/availability.ts
→ tests/unit/availability.test.ts
```

`<source>.ts` → `<source>.test.ts`

### Struktura

```typescript
import { describe, it, expect } from "vitest";
import { computeAvailableSlots } from "@/lib/booking/availability";

describe("computeAvailableSlots", () => {
  it("vraca prazan array za dan u prošlosti", () => {
    const result = computeAvailableSlots({
      date: new Date("2020-01-01"),
      now: new Date("2026-06-15"),
      // ...
    });
    expect(result).toEqual([]);
  });

  describe("kad je dan blokiran", () => {
    it("vraca prazno", () => {
      // ...
    });
  });
});
```

`describe` za grupisanje, `it` za individual case. Naziv testova u srpskom (za UI logiku) ili engleskom (za internal API).

### Test runner

```bash
npm test                    # Run sve, exit kad gotovo
npm run test:watch          # Watch mode
npm test -- availability    # Filter (samo availability fajl)
npm test -- -t "kad je dan" # Filter test name pattern
```

## Coverage

Vitest podržava `c8` coverage:

```bash
npx vitest run --coverage
```

Trenutno **nije setup-an kao default** (sporo, dodaje vrijeme). Možemo dodati ako treba.

## Mocking

Većina testova nije mock-irana — pure funkcije rade direktno.

### Mock Date.now (rijetko)

```typescript
import { vi } from "vitest";
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
// ... test
vi.useRealTimers();
```

### Mock module (rijetko)

```typescript
vi.mock("@/lib/foo", () => ({
  default: vi.fn(() => "mocked"),
}));
```

Generalno: izbjegavamo mock-ove. Pure functions su lakše za testirati.

## Edge cases coverage

Test za svaki edge case nije obavezan ali je preporučen. Posebno za booking engine.

Vidi npr. `availability.test.ts`:
- 60min / 90min / 120min / 180min services
- Empty day
- Boundary cases
- DST transitions
- Overlap kombinacije
- Sub-day blocks
- Off-grid blocks
- Settings fallback

## CI

GitHub Actions može run-ovati testove na PR-u (TBD setup). Trenutno: manual run pre commit-a.

## Performance

- `npm test` ~5s
- Per-file ~50-500ms

## Sledeće

- [e2e-tests.md](./e2e-tests.md) — browser testovi
- [npm-scripts.md](./npm-scripts.md) — sve test komande
