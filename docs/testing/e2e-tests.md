# E2E testovi — Playwright

Browser testovi koji simulišu real klijent/admin flow.

## Config

**Fajl:** `playwright.config.ts`

```typescript
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,       // Serial — testovi dijele DB state
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER ? undefined : {
    command: process.env.DOTENV_CONFIG_PATH
      ? `env $(cat ${...}) npm run dev`
      : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

| Opcija | Razlog |
|--------|--------|
| `serial mode` (workers=1) | Testovi dijele DB state |
| `globalSetup` | Cleanup test data prije svih testova |
| `trace on-first-retry` | Debug failed testove |
| `webServer` | Auto-start dev server-a |

## Lista test fajlova

| Fajl | Šta testira |
|------|-------------|
| `booking.spec.ts` | Happy path booking-a |
| `booking-conflict.spec.ts` | Slot zauzet, ne pojavljuje se |
| `booking-cross-service.spec.ts` | Šminkanje blokira Pedikir |
| `double-booking.spec.ts` | Sprjecavanje 2 termina isti slot |
| `cancel-frees-slot.spec.ts` | Otkazivanje oslobađa slot |
| `data-integrity.spec.ts` | Sva polja persistirana |
| `time-blocks.spec.ts` | Time block skriva slotove |
| `time-blocks-privacy.spec.ts` | Anon ne vidi `reason` |
| `working-hours.spec.ts` | Override radnog vremena |
| `admin-login.spec.ts` | Login valid/invalid |
| `admin-manual-booking.spec.ts` | Manuelni booking |
| `admin-time-block.spec.ts` | Kreiranje time block-a |
| `admin-wa-messages.spec.ts` | WhatsApp poruke per status |
| `admin-mark-completed-snapshot.spec.ts` | Mark completed flow |
| `admin-service-delete.spec.ts` | Service delete |
| `admin-service-image.spec.ts` | Service slika upload |
| `admin-realtime-appointments.spec.ts` | Realtime updates |
| `admin-termini-tz.spec.ts` | Timezone u admin |
| `admin-layout-guard.spec.ts` | Auth guard |
| `dashboard-day-navigator.spec.ts` | Day picker |
| `landing-hero.spec.ts` | Hero render |
| `pwa.spec.ts` | PWA manifests |
| `seo.spec.ts` | Title, description, OG |
| `seo-round-2.spec.ts` | Strukturirani podaci |
| `security-headers.spec.ts` | HTTP headers |
| `open-redirect.spec.ts` | Open redirect zaštita |

## Global setup

**Fajl:** `tests/e2e/global-setup.ts`

```typescript
export default async function globalSetup() {
  // Cleanup test data prije svih testova
  await cleanupByPrefix("E2E");
  await cleanupByPrefix("Test Klijent");
}
```

Pre svake test run-a: briše bilo koje test appointment-e koji su ostali od prethodnih run-ova.

## Helperi

**Fajl:** `tests/e2e/helpers.ts`

### Supabase pristup

```typescript
import { createClient } from "@supabase/supabase-js";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);  // bypass RLS
```

### Date helperi (TZ-aware)

```typescript
export function sarajevoDate(year, month, day, hour, min = 0): Date {
  // Sarajevo TZ-aware Date construction
}
```

### CRUD helperi

```typescript
export async function insertAppointment(serviceId, start, duration, name) { ... }
export async function deleteAppointment(id) { ... }
export async function cancelAppointment(id) { ... }
export async function cleanupByPrefix(prefix) { ... }
export async function getAppointmentByName(name) { ... }
```

Koriste se u test fajlovima da kreiraju seed data + cleanup.

## Tipičan test

```typescript
import { test, expect } from "@playwright/test";
import { sarajevoDate, cleanupByPrefix } from "./helpers";

test("klijent rezerviše termin", async ({ page }) => {
  const uniqueName = `E2E ${Date.now()}`;

  await page.goto("/zakazi");
  await page.getByRole("button", { name: /Šminkanje/ }).first().click();

  // Datum
  const target = sarajevoDate(2026, 6, 15, 17, 0);
  await page.getByRole("button", { name: "15" }).click();

  // Slot
  await page.getByRole("button", { name: "17:00" }).click();

  // Forma
  await page.getByLabel("Ime").fill(uniqueName);
  await page.getByLabel("Telefon").fill("065 123 456");
  await page.getByLabel(/Saglasan/).check();
  await page.getByRole("button", { name: /Potvrdi/ }).click();

  // Verifikuj redirect
  await expect(page).toHaveURL(/uspjesno\?token=/);

  // Cleanup
  await cleanupByPrefix("E2E");
});
```

## DOTENV_CONFIG_PATH

Tokom `npm run test:e2e:local`:

```bash
DOTENV_CONFIG_PATH=.env.test playwright test
```

Playwright config detektuje:

```typescript
command: process.env.DOTENV_CONFIG_PATH
  ? `env $(cat ${process.env.DOTENV_CONFIG_PATH} | grep -v '^#' | xargs) npm run dev`
  : "npm run dev",
```

Tako da `npm run dev` koji se pokrene unutar test runner-a koristi `.env.test` umjesto `.env.local`. Sprjecava da testovi pogode produkciju.

## Trace viewer

Kad test fail:

```bash
npx playwright show-trace test-results/.../trace.zip
```

Vidiš:
- Screenshot u svakom step-u
- Network requests
- Console logs
- DOM snapshots

Izuzetno korisno za debug.

## Headed mode

Default je headless (bez UI). Za debug:

```bash
npx playwright test --headed
```

Vidiš browser dok testovi rade. Sporo ali nekad korisno.

## Codegen

Generiši test code iz browser interakcija:

```bash
npx playwright codegen http://localhost:3000
```

Klikneš kroz sajt → Playwright generiše test code.

## Performance

- Cijela e2e suite: ~3 min
- Per test: ~10-30s
- Web server startup: ~5s (jednom)

Sporo zbog real browser-a. Trade-off: koverage od full flow-a.

## Limitations

- **Bez paralelizma:** serial mode (workers=1) jer testovi dijele DB state. Mogli bismo paralelizovati sa pažljivim seed-om, ali kompleksno.
- **Bez vizuelne regresije:** ne testiramo "izgleda li sajt isto". Mogli bismo dodati screenshot comparison.
- **Single browser:** samo Chromium. Možemo dodati Firefox/WebKit.

## Sledeće

- [docker-setup.md](./docker-setup.md) — pripremi okruženje
- [npm-scripts.md](./npm-scripts.md) — sve test komande
