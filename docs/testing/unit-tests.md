# Unit testovi — Vitest

**304 testa** u `tests/unit/`. Pokrivaju pure logiku.

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

| Fajl | Broj testova | Šta pokriva |
|------|--------------|-------------|
| `availability.test.ts` | 127 | `computeAvailableSlots()` algoritam |
| `breadcrumbs-jsonld.test.ts` | ~6 | `buildBreadcrumbsJsonLd()` |
| `services-jsonld.test.ts` | ~8 | `buildServicesJsonLd()` |
| `phone.test.ts` | 26 | Phone normalization (BA + intl) |
| `format.test.ts` | ~10 | Date, time, price formatting |
| `wa.test.ts` | ~5 | WhatsApp link generator |
| `wa-messages.test.ts` | ~6 | Status-adaptive messages |
| `grid.test.ts` | 8 | `isGridAligned()`, `assertGridAligned()` |
| `settings.test.ts` | 4 | `parseBookingSettings()` fallback |
| `rules.test.ts` | ~5 | `getHoursForDay()`, hours map |
| `services-schema.test.ts` | ~10 | Zod service schema |
| `booking-schemas.test.ts` | 19 | Booking form + manual schemas |
| `rate-limit.test.ts` | 8 | Rate limiter + IP detection |
| `safe-redirect.test.ts` | ~5 | Open redirect protection |
| `admin-emails.test.ts` | ~3 | `isAdminEmail()` |
| `site-url.test.ts` | ~5 | URL normalization |
| `gallery-categories.test.ts` | ~3 | Category list |
| `tz.test.ts` | ~10 | Sarajevo TZ helpers |
| `termini-filters.test.ts` | ~8 | Filter logika |
| `month-availability.test.ts` | ~10 | Month-level avail. |
| `day-bounds.test.ts` | ~5 | Day boundary helpers |
| `status-counts.test.ts` | ~5 | Status counting |
| `group-by-day.test.ts` | ~5 | Grouping helpers |
| `cache-tags.test.ts` | ~3 | Cache tag generation |
| `admin-prefs.test.ts` | ~5 | Local prefs serialize |
| `push-payload.test.ts` | ~3 | Push notification payload |
| `log.test.ts` | ~3 | Structured logging |
| `smoke.test.ts` | 1 | Smoke test |

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
- Najsporiji: `availability.test.ts` (~500ms, 127 testova)

## Sledeće

- [e2e-tests.md](./e2e-tests.md) — browser testovi
- [npm-scripts.md](./npm-scripts.md) — sve test komande
