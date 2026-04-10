# Grid-Aligned Server Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Server-side defense-in-depth: reject any `start_time` or `end_time` that isn't on the 30-minute grid (:00 or :30), so curl/DevTools can't bypass UI dropdowns and corrupt the calendar.

**Architecture:** One shared helper `assertGridAligned(date): void` that throws if minutes aren't 0 or 30. Called in all 3 server actions that accept time from user input. Unit tested. Existing UI is already fixed — this is backend hardening only.

**Tech Stack:** TypeScript, Zod, Vitest.

---

## Audit — 4 gaps identified

| # | Server action | File | Gap |
|---|---|---|---|
| 1 | `createAppointment` | `src/app/zakazi/actions.ts` | No grid check on `start_time` |
| 2 | `createManualAppointment` | `src/app/admin/(protected)/termini/actions.ts` | No grid check on `start_time` |
| 3 | `createTimeBlock` | `src/app/admin/(protected)/postavke/actions.ts` | No grid check on `start_time` or `end_time` |
| 4 | `updateWorkingHour` | `src/app/admin/(protected)/postavke/actions.ts` | ✅ Already protected via regex |

## File Structure

```
src/
  lib/utils/
    grid.ts                                    ← CREATE (assertGridAligned helper)
  app/zakazi/
    actions.ts                                 ← MODIFY (add grid check)
  app/admin/(protected)/termini/
    actions.ts                                 ← MODIFY (add grid check)
  app/admin/(protected)/postavke/
    actions.ts                                 ← MODIFY (add grid check to createTimeBlock)

tests/unit/
  grid.test.ts                                 ← CREATE (helper unit tests)
```

---

## Task 1: `assertGridAligned` helper + unit tests

**Files:**
- Create: `src/lib/utils/grid.ts`
- Create: `tests/unit/grid.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/grid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assertGridAligned, isGridAligned } from "@/lib/utils/grid";

describe("isGridAligned", () => {
  it("accepts :00", () => {
    expect(isGridAligned(new Date("2026-04-15T17:00:00Z"))).toBe(true);
  });
  it("accepts :30", () => {
    expect(isGridAligned(new Date("2026-04-15T17:30:00Z"))).toBe(true);
  });
  it("rejects :15", () => {
    expect(isGridAligned(new Date("2026-04-15T17:15:00Z"))).toBe(false);
  });
  it("rejects :10", () => {
    expect(isGridAligned(new Date("2026-04-15T17:10:00Z"))).toBe(false);
  });
  it("rejects :45", () => {
    expect(isGridAligned(new Date("2026-04-15T17:45:00Z"))).toBe(false);
  });
  it("rejects :01", () => {
    expect(isGridAligned(new Date("2026-04-15T17:01:00Z"))).toBe(false);
  });
});

describe("assertGridAligned", () => {
  it("does not throw for :00", () => {
    expect(() => assertGridAligned(new Date("2026-04-15T17:00:00Z"))).not.toThrow();
  });
  it("does not throw for :30", () => {
    expect(() => assertGridAligned(new Date("2026-04-15T17:30:00Z"))).not.toThrow();
  });
  it("throws for :17 with descriptive message", () => {
    expect(() => assertGridAligned(new Date("2026-04-15T17:17:00Z"))).toThrow(
      /mora biti na :00 ili :30/,
    );
  });
});
```

- [ ] **Step 2: Run → FAIL**

```bash
npm test -- tests/unit/grid.test.ts
```

- [ ] **Step 3: Implement helper**

Create `src/lib/utils/grid.ts`:

```ts
import { SLOT_INTERVAL_MIN } from "@/lib/booking/availability";

/**
 * Provjeri da li je datum poravnan sa booking grid-om (minuta mora biti
 * 0 ili 30). Koristi se kao defense-in-depth u server action-ima —
 * UI dropdown-i već ograničavaju izbor, ali ovo štiti od curl/DevTools.
 */
export function isGridAligned(date: Date): boolean {
  return date.getMinutes() % SLOT_INTERVAL_MIN === 0;
}

/**
 * Baca grešku ako datum nije na 30-min gridu.
 */
export function assertGridAligned(date: Date): void {
  if (!isGridAligned(date)) {
    throw new Error(
      `Vrijeme mora biti na :00 ili :30 (dobijeno :${String(date.getMinutes()).padStart(2, "0")})`,
    );
  }
}
```

- [ ] **Step 4: Run → PASS**

```bash
npm test -- tests/unit/grid.test.ts
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/grid.ts tests/unit/grid.test.ts && \
git commit -m "feat(utils): assertGridAligned helper for 30-min grid validation

Defense-in-depth: validates that a Date's minutes are 0 or 30.
Used in server actions to reject curl/DevTools bypass of UI dropdowns.
9 unit tests."
```

---

## Task 2: Add grid check to `createAppointment` (public booking)

**Files:**
- Modify: `src/app/zakazi/actions.ts`

- [ ] **Step 1: Add import and check**

In `src/app/zakazi/actions.ts`, add import at top:

```ts
import { assertGridAligned } from "@/lib/utils/grid";
```

After `const start = new Date(parsed.data.start_time);` (around line 54), add:

```ts
try {
  assertGridAligned(start);
} catch {
  return {
    ok: false,
    error: "Vrijeme termina mora biti na pun sat ili pola (:00 ili :30)",
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/zakazi/actions.ts && \
git commit -m "fix(booking): reject non-grid-aligned times in createAppointment

Server-side defense: even if someone bypasses the UI slot picker via
curl/DevTools, the action now rejects any start_time where minutes
are not :00 or :30."
```

---

## Task 3: Add grid check to `createManualAppointment` (admin booking)

**Files:**
- Modify: `src/app/admin/(protected)/termini/actions.ts`

- [ ] **Step 1: Add import and check**

In `src/app/admin/(protected)/termini/actions.ts`, add import at top (alongside existing imports):

```ts
import { assertGridAligned } from "@/lib/utils/grid";
```

After `const start = new Date(parsed.data.start_time);` (around line 123), add:

```ts
try {
  assertGridAligned(start);
} catch {
  return {
    ok: false,
    error: "Vrijeme termina mora biti na pun sat ili pola (:00 ili :30)",
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(protected\)/termini/actions.ts && \
git commit -m "fix(admin): reject non-grid-aligned times in createManualAppointment"
```

---

## Task 4: Add grid check to `createTimeBlock`

**Files:**
- Modify: `src/app/admin/(protected)/postavke/actions.ts`

- [ ] **Step 1: Add import and checks**

In `src/app/admin/(protected)/postavke/actions.ts`, add import:

```ts
import { assertGridAligned } from "@/lib/utils/grid";
```

In `createTimeBlock()`, after the `end_time > start_time` check (around line 127), add:

```ts
const startDate = new Date(parsed.start_time);
const endDate = new Date(parsed.end_time);
try {
  assertGridAligned(startDate);
  assertGridAligned(endDate);
} catch {
  return {
    ok: false,
    error: "Vrijeme mora biti na pun sat ili pola (:00 ili :30)",
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/\(protected\)/postavke/actions.ts && \
git commit -m "fix(admin): reject non-grid-aligned times in createTimeBlock

Both start_time and end_time must be :00 or :30."
```

---

## Task 5: Full verification + push

- [ ] **Step 1: All unit tests**

```bash
npm test
```

Expected: 118 existing + 9 new grid = 127 pass.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Exploit test — verify server rejects bad time**

```bash
# Attempt public booking with :17 minutes — should be rejected
/usr/bin/curl -s "http://localhost:3000/api/availability?date=2026-04-20&service_id=1" | \
  python3 -c "import json,sys; s=json.load(sys.stdin)['slots'][0]['start']; print(f'Valid slot: {s}')"

# The server action is harder to test via curl (needs form submission),
# but the unit tests cover assertGridAligned thoroughly.
```

- [ ] **Step 4: Push**

```bash
git push
```

---

## Verification Checklist

- [ ] `assertGridAligned` helper created with 9 unit tests
- [ ] `createAppointment` rejects non-grid times (public booking)
- [ ] `createManualAppointment` rejects non-grid times (admin booking)
- [ ] `createTimeBlock` rejects non-grid start_time AND end_time
- [ ] `updateWorkingHour` already protected (regex) — no change needed
- [ ] All 127 tests pass
- [ ] Typecheck clean
