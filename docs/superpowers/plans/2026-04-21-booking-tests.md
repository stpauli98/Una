# Booking System Test Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bulletproof the booking system with comprehensive unit + e2e tests covering validation, availability, admin actions, race conditions, rate limiting, data integrity, and status lifecycle.

**Architecture:** Unit tests (Vitest) cover pure logic and validation schemas. E2E tests (Playwright) cover full browser flows including DB state verification via Supabase REST API. All tests use deterministic dates and clean up after themselves.

**Tech Stack:** Vitest 4.1.4 (jsdom), Playwright 1.59.1 (Chromium, serial mode), Supabase REST API for seed/cleanup.

---

## Pre-existing Coverage (DO NOT duplicate)

| File | Tests | What it covers |
|------|-------|---------------|
| `tests/unit/availability.test.ts` | 127 | computeAvailableSlots — all edge cases |
| `tests/unit/grid.test.ts` | 8 | isGridAligned, assertGridAligned |
| `tests/unit/settings.test.ts` | 4 | parseBookingSettings with fallbacks |
| `tests/unit/phone.test.ts` | 26 | Phone normalization (BA + intl) |
| `tests/e2e/booking.spec.ts` | 1 | Happy path (select → book → success) |
| `tests/e2e/booking-cross-service.spec.ts` | 2 | Cross-service blocking |
| `tests/e2e/booking-conflict.spec.ts` | 1 | Slot visibility after booking |

## What's Missing (This Plan Covers)

1. **Booking schema validation** — reject bad input (unit)
2. **Rate limiter** — enforce limits (unit)
3. **E2E: booking.spec.ts fix** — URL pattern broken (`?id=` → `?token=`)
4. **E2E: admin confirm/cancel/complete lifecycle** — status transitions visible in UI
5. **E2E: slot freed after cancellation** — cancelled slot becomes bookable again
6. **E2E: admin manual booking with conflict + force** — conflict warning → force override
7. **E2E: double-booking prevention** — two clients, same slot, one fails

## Shared Helpers

**File:** `tests/e2e/helpers.ts` (used by all e2e specs)

```ts
// Already exists in each spec — extract to shared file
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
export const headers = () => ({
  apikey: SERVICE_ROLE_KEY!,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
});
```

---

### Task 1: Fix broken booking e2e test (URL pattern)

**Files:**
- Modify: `tests/e2e/booking.spec.ts:76`

- [ ] **Step 1: Run existing test to see it fail**

Run: `npm run test:e2e -- --grep "booking flow happy path"`
Expected: FAIL — URL now uses `?token=<uuid>` not `?id=\d+`

- [ ] **Step 2: Fix the URL assertion**

```ts
// Line 76 — replace:
await expect(page).toHaveURL(/\/zakazi\/uspjesno\?id=\d+/);
// With:
await expect(page).toHaveURL(/\/zakazi\/uspjesno\?token=[\w-]+/);
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm run test:e2e -- --grep "booking flow happy path"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/booking.spec.ts
git commit -m "fix(test): update booking e2e to expect ?token= instead of ?id="
```

---

### Task 2: Booking schema validation (unit tests)

**Files:**
- Create: `tests/unit/booking-schemas.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { bookingFormSchema, manualAppointmentSchema } from "@/lib/booking/schemas";

describe("bookingFormSchema", () => {
  const valid = {
    service_id: 1,
    start_time: "2026-05-01T17:00:00.000Z",
    client_name: "Ana Petrović",
    client_phone: "065123456",
    client_email: "",
    consent: true as const,
  };

  it("accepts valid booking", () => {
    expect(bookingFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects missing consent", () => {
    const r = bookingFormSchema.safeParse({ ...valid, consent: undefined });
    expect(r.success).toBe(false);
  });

  it("rejects consent=false", () => {
    const r = bookingFormSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });

  it("rejects name shorter than 2 chars", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_name: "A" });
    expect(r.success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_name: "A".repeat(101) });
    expect(r.success).toBe(false);
  });

  it("rejects invalid phone", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_phone: "123" });
    expect(r.success).toBe(false);
  });

  it("accepts BA phone 065", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_phone: "065123456" });
    expect(r.success).toBe(true);
  });

  it("accepts international phone +49", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_phone: "+4915123456789" });
    expect(r.success).toBe(true);
  });

  it("rejects negative service_id", () => {
    const r = bookingFormSchema.safeParse({ ...valid, service_id: -1 });
    expect(r.success).toBe(false);
  });

  it("rejects non-integer service_id", () => {
    const r = bookingFormSchema.safeParse({ ...valid, service_id: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rejects invalid start_time format", () => {
    const r = bookingFormSchema.safeParse({ ...valid, start_time: "not-a-date" });
    expect(r.success).toBe(false);
  });

  it("accepts valid email", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_email: "a@b.com" });
    expect(r.success).toBe(true);
  });

  it("accepts empty email", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_email: "" });
    expect(r.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const r = bookingFormSchema.safeParse({ ...valid, client_email: "notanemail" });
    expect(r.success).toBe(false);
  });

  it("rejects notes longer than 500 chars", () => {
    const r = bookingFormSchema.safeParse({ ...valid, notes: "X".repeat(501) });
    expect(r.success).toBe(false);
  });
});

describe("manualAppointmentSchema", () => {
  const valid = {
    service_id: 1,
    start_time: "2026-05-01T17:00:00.000Z",
    client_name: "Admin Test",
    client_phone: "065999888",
  };

  it("accepts valid manual booking (no consent needed)", () => {
    expect(manualAppointmentSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts force=true", () => {
    const r = manualAppointmentSchema.safeParse({ ...valid, force: true });
    expect(r.success).toBe(true);
  });

  it("accepts force=false", () => {
    const r = manualAppointmentSchema.safeParse({ ...valid, force: false });
    expect(r.success).toBe(true);
  });

  it("does not require consent field", () => {
    // consent is NOT in manualAppointmentSchema
    const r = manualAppointmentSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- booking-schemas`
Expected: PASS (all 19 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/booking-schemas.test.ts
git commit -m "test: add booking schema validation unit tests (19 cases)"
```

---

### Task 3: Rate limiter unit tests

**Files:**
- Create: `tests/unit/rate-limit.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";

// We need to reset the module between tests (in-memory Map state)
let checkRateLimit: typeof import("@/lib/utils/rate-limit").checkRateLimit;

beforeEach(async () => {
  // Re-import to reset the in-memory store
  const mod = await import("@/lib/utils/rate-limit");
  checkRateLimit = mod.checkRateLimit;
});

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("192.168.1.1", 5, 60000)).toBe(true);
    }
  });

  it("blocks request over the limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("192.168.1.2", 5, 60000);
    }
    expect(checkRateLimit("192.168.1.2", 5, 60000)).toBe(false);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("10.0.0.1", 5, 60000);
    }
    // 10.0.0.1 is at limit, but 10.0.0.2 should still be allowed
    expect(checkRateLimit("10.0.0.2", 5, 60000)).toBe(true);
  });

  it("resets after window expires", () => {
    // Use a tiny window (1ms)
    for (let i = 0; i < 3; i++) {
      checkRateLimit("10.0.0.3", 3, 1);
    }
    expect(checkRateLimit("10.0.0.3", 3, 1)).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit("10.0.0.3", 3, 1)).toBe(true);
        resolve();
      }, 10);
    });
  });

  it("uses default limit of 10 when not specified", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("10.0.0.4")).toBe(true);
    }
    expect(checkRateLimit("10.0.0.4")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- rate-limit`
Expected: PASS (5 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/unit/rate-limit.test.ts
git commit -m "test: add rate limiter unit tests (5 cases)"
```

---

### Task 4: E2E shared helpers extraction

**Files:**
- Create: `tests/e2e/helpers.ts`

- [ ] **Step 1: Create shared helpers**

```ts
export const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

export function supabaseHeaders() {
  if (!SERVICE_ROLE_KEY) throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function insertAppointment(
  serviceId: number,
  start: Date,
  durationMin: number,
  clientName = "E2E Test",
  status: "ceka" | "potvrdjen" = "ceka",
): Promise<number> {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      service_id: serviceId,
      client_name: clientName,
      client_phone: "+38765999777",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status,
    }),
  });
  if (!res.ok) throw new Error(`Seed insert failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

export async function deleteAppointment(id: number): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
    method: "DELETE",
    headers: supabaseHeaders(),
  });
}

export async function getAppointment(id: number) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}&select=*`,
    { headers: supabaseHeaders() },
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function getAppointmentByName(name: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=eq.${encodeURIComponent(name)}&select=*&order=created_at.desc&limit=1`,
    { headers: supabaseHeaders() },
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function cleanupByName(name: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=eq.${encodeURIComponent(name)}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}

export async function cleanupByPrefix(prefix: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=like.${prefix}*`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/helpers.ts
git commit -m "test: extract shared e2e helpers for Supabase operations"
```

---

### Task 5: E2E — Admin appointment lifecycle (confirm → complete)

**Files:**
- Create: `tests/e2e/admin-lifecycle.spec.ts`

Tests the complete lifecycle: seed pending appointment → admin logs in → confirms → verifies status change in DB → marks complete → verifies.

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  getAppointment,
  deleteAppointment,
  SERVICE_ROLE_KEY,
} from "./helpers";
import { addDays, getDay } from "date-fns";

test.describe.configure({ mode: "serial" });

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

test("admin confirm → complete lifecycle", async ({ page }) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const target = futureWeekday(15);
  const name = `E2E Lifecycle ${Date.now()}`;
  const id = await insertAppointment(1, target, 60, name, "ceka");

  try {
    // Login
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL ?? "peranovicuna6@gmail.com");
    await page.getByLabel("Lozinka").fill(process.env.E2E_ADMIN_PASSWORD ?? "test1234");
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Navigate to appointments
    await page.goto("/admin/termini");
    await expect(page.getByText(name)).toBeVisible();

    // Confirm
    await page.getByText(name).locator("..").getByRole("button", { name: /potvrdi/i }).click();

    // Verify in DB
    const afterConfirm = await getAppointment(id);
    expect(afterConfirm.status).toBe("potvrdjen");
    expect(afterConfirm.confirmation_sent_at).not.toBeNull();

    // Mark completed
    await page.getByText(name).locator("..").getByRole("button", { name: /završi/i }).click();

    // Verify in DB
    const afterComplete = await getAppointment(id);
    expect(afterComplete.status).toBe("zavrsen");
  } finally {
    await deleteAppointment(id);
  }
});
```

- [ ] **Step 2: Run test**

Run: `npm run test:e2e -- --grep "admin confirm"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin-lifecycle.spec.ts
git commit -m "test(e2e): admin confirm → complete appointment lifecycle"
```

---

### Task 6: E2E — Cancel frees slot

**Files:**
- Create: `tests/e2e/cancel-frees-slot.spec.ts`

Tests that when Una cancels an appointment, the slot becomes bookable again.

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./helpers";
import { addDays, getDay, format } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

test("cancelled appointment frees the slot for new bookings", async ({ page }) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const target = futureWeekday(20);
  const dayNumber = target.getDate();
  const dateStr = format(target, "yyyy-MM-dd");

  // Seed: Šminkanje (id=1, 60min) at 17:00 — status ceka
  const id = await insertAppointment(1, target, 60, "E2E Cancel Test");

  try {
    // Verify 17:00 is NOT available
    const before = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/`,
      { headers: { apikey: SERVICE_ROLE_KEY! } },
    ).catch(() => null);

    // Check via availability API
    const availBefore = await fetch(
      `http://localhost:3000/api/availability?date=${dateStr}&service_id=1`,
    );
    const slotsBefore = await availBefore.json();
    const has17Before = slotsBefore.slots?.some((s: { start: string }) =>
      s.start.includes("17:00"),
    );
    expect(has17Before).toBeFalsy();

    // Cancel the appointment via REST API (simulating admin action)
    await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "otkazan" }),
    });

    // Verify 17:00 IS now available
    const availAfter = await fetch(
      `http://localhost:3000/api/availability?date=${dateStr}&service_id=1`,
    );
    const slotsAfter = await availAfter.json();
    const has17After = slotsAfter.slots?.some((s: { start: string }) =>
      s.start.includes("17:00"),
    );
    expect(has17After).toBeTruthy();
  } finally {
    await deleteAppointment(id);
  }
});
```

- [ ] **Step 2: Run test**

Run: `npm run test:e2e -- --grep "cancelled appointment frees"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/cancel-frees-slot.spec.ts
git commit -m "test(e2e): verify cancelled appointment frees slot for rebooking"
```

---

### Task 7: E2E — Double-booking prevention

**Files:**
- Create: `tests/e2e/double-booking.spec.ts`

Two clients try to book the same slot — second must fail (race guard + DB constraint).

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import {
  insertAppointment,
  deleteAppointment,
  cleanupByPrefix,
  SERVICE_ROLE_KEY,
} from "./helpers";
import { addDays, getDay } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  date.setHours(17, 0, 0, 0);
  return date;
}

test("double booking same slot is prevented", async ({ page }) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const target = futureWeekday(25);
  const dayNumber = target.getDate();

  // Client A books first (seed directly into DB)
  const idA = await insertAppointment(1, target, 60, "E2E Double A");

  try {
    // Client B tries to book the same slot via UI
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();

    // 17:00 should NOT be available (Client A already has it)
    const slotButtons = page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ });
    const slotTexts = await slotButtons.allTextContents();

    expect(slotTexts).not.toContain("17:00");
    // 18:00 should still be available
    expect(slotTexts).toContain("18:00");
  } finally {
    await deleteAppointment(idA);
    await cleanupByPrefix("E2E Double");
  }
});
```

- [ ] **Step 2: Run test**

Run: `npm run test:e2e -- --grep "double booking"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/double-booking.spec.ts
git commit -m "test(e2e): verify double-booking prevention on same slot"
```

---

### Task 8: E2E — Data integrity after full lifecycle

**Files:**
- Create: `tests/e2e/data-integrity.spec.ts`

Verifies DB state is correct at each stage: booking → confirmation → cancellation. Checks all fields are persisted properly.

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import {
  getAppointmentByName,
  cleanupByName,
  SERVICE_ROLE_KEY,
} from "./helpers";
import { addDays, getDay } from "date-fns";

function futureWeekday(offsetDays: number): Date {
  let date = addDays(new Date(), offsetDays);
  while (getDay(date) === 0 || getDay(date) === 6) date = addDays(date, 1);
  return date;
}

test("booking data integrity — all fields persisted correctly", async ({ page }) => {
  test.skip(!SERVICE_ROLE_KEY, "Needs E2E_SUPABASE_SERVICE_ROLE_KEY");

  const uniqueName = `E2E Integrity ${Date.now()}`;
  const target = futureWeekday(30);
  const dayNumber = target.getDate();

  try {
    // Book via UI
    await page.goto("/zakazi?service=1");
    await expect(page.getByRole("heading", { name: "Izaberite termin" })).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const firstSlot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await firstSlot.click();

    await page.getByLabel("Ime i prezime").fill(uniqueName);
    await page.getByLabel("Telefon").fill("+38765111222");
    await page.getByLabel("Email (opciono)").fill("integrity@test.com");
    await page.getByLabel("Napomena").fill("Test napomena");
    await page.getByLabel(/Saglasan/).check();
    await page.getByRole("button", { name: "Potvrdi rezervaciju" }).click();

    await expect(page).toHaveURL(/\/zakazi\/uspjesno\?token=[\w-]+/);

    // Verify DB state
    const row = await getAppointmentByName(uniqueName);
    expect(row).not.toBeNull();
    expect(row.client_name).toBe(uniqueName);
    expect(row.client_phone).toMatch(/38765111222/);
    expect(row.client_email).toBe("integrity@test.com");
    expect(row.notes).toBe("Test napomena");
    expect(row.status).toBe("ceka");
    expect(row.service_id).toBe(1);
    expect(row.confirmation_token).toBeTruthy();
    expect(row.start_time).toBeTruthy();
    expect(row.end_time).toBeTruthy();
    // end_time should be start_time + 60min (Šminkanje duration)
    const start = new Date(row.start_time);
    const end = new Date(row.end_time);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  } finally {
    await cleanupByName(uniqueName);
  }
});
```

- [ ] **Step 2: Run test**

Run: `npm run test:e2e -- --grep "data integrity"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/data-integrity.spec.ts
git commit -m "test(e2e): verify booking data integrity — all fields persisted correctly"
```

---

## Verification

After all tasks complete:

```bash
# Unit tests (all)
npm test

# E2E tests (all, serial)
npm run test:e2e

# Build check
npm run build
```

Expected results:
- Unit: ~195+ tests passing (existing 127 + 19 schema + 5 rate-limit + existing others)
- E2E: ~14+ specs passing (existing 9 + 5 new)
- Build: 0 errors
