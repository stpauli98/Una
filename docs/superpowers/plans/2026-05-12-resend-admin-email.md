# Resend Admin Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ili superpowers:executing-plans. Steps koriste checkbox (`- [ ]`) sintaksu.
>
> **Phase-by-phase isolated testing:** Korisnik je tražio strogo izolovano testiranje po fazama. Svaka faza dispatchuje fresh subagent (no context pollution) i SLJEDEĆA FAZA NE POČINJE dok prethodna nije completed bez grešaka (typecheck + tests + reviews sve passing).

**Goal:** Una dobija HTML+text email pri svakoj novoj rezervaciji koja stigne kroz javni `/zakazi` flow.

**Architecture:** 3 nova modula u `src/lib/notifications/` (Resend client wrapper, pure template renderer, orchestrator). Trigger u postojećoj `createAppointment` server actionu kao fire-and-log async call.

**Tech Stack:** Resend SDK (`resend@^4`), Vitest za unit testove, postojeći `sanitizeError` helper za PII-safe logging, Sarajevo TZ formatting kroz `date-fns-tz` (već u deps).

**Spec:** `docs/superpowers/specs/2026-05-12-resend-admin-email-design.md`

---

## File Structure

**Created:**
- `src/lib/notifications/resend.ts` (~25 linija) — lazy singleton Resend client, vraća `null` ako env nije setovan
- `src/lib/notifications/templates.ts` (~130 linija) — pure `renderNewAppointmentEmail(input)` koja vraća `{ subject, html, text }`
- `src/lib/notifications/send-admin-email.ts` (~50 linija) — orchestrator `sendNewAppointmentEmail(input)`
- `tests/unit/notifications/templates.test.ts` — 4-5 testova za render scenarije
- `tests/unit/notifications/send-admin-email.test.ts` — 3 testa za orchestrator sa mock-ovanim Resend-om

**Modified:**
- `src/app/zakazi/actions.ts` — dodaje async fire-and-log trigger nakon INSERT-a (linija ~133, gdje stoji `// TODO(Phase 8): sendNewAppointmentEmail(...)`)
- `package.json` + `package-lock.json` — `resend@^4`
- `README.md` — sekcija "Resend email setup" (kako admin postavlja API key i verifikuje domen)

**Read-only reference:**
- `src/lib/utils/log.ts` — `sanitizeError()` koristi se u catch blokovima
- `src/lib/constants/business.ts` — `BUSINESS.name`, `BUSINESS.address` za email footer

---

## Phase 1 — Foundation (pure modules + unit testovi)

Cilj: imati testirane "pure" module bez integration sa server action-om.

**Phase 1 done when:**
- ✅ `npm test` pass-uje sve nove unit testove
- ✅ `npm run typecheck` pass
- ✅ `npm run lint` pass (no new errors)
- ✅ Spec + code review approved za svaki Phase 1 task

---

### Task 1.1: Install resend SDK

**Files:**
- Modify: `package.json` + `package-lock.json`

- [ ] **Step 1: Install**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm install resend@^4
```
Expected: `added X packages`.

- [ ] **Step 2: Verify require**

```bash
node -e "require('resend'); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add resend@^4 (admin email notifikacija)"
```

---

### Task 1.2: Resend client singleton

**Files:**
- Create: `src/lib/notifications/resend.ts`

- [ ] **Step 1: Napiši modul**

```ts
// src/lib/notifications/resend.ts
import { Resend } from "resend";

/**
 * Lazy singleton Resend client.
 *
 * Vraća `null` ako `RESEND_API_KEY` nije setovan (lokalni dev bez Resend
 * account-a). Sve funkcije koje koriste ovo MORAJU graceful-skip-ovati
 * ako je `null` (vidi send-admin-email.ts).
 */
let cachedClient: Resend | null | undefined = undefined;

export function getResendClient(): Resend | null {
  if (cachedClient !== undefined) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/** Testing helper — reset singleton između testova. */
export function _resetResendClientForTests(): void {
  cachedClient = undefined;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/resend.ts
git commit -m "feat(notifications): lazy singleton Resend client

Graceful skip ako RESEND_API_KEY nije set. Testing helper za reset
singleton stanja između testova."
```

---

### Task 1.3: Template renderer + testovi (TDD)

**Files:**
- Create: `src/lib/notifications/templates.ts`
- Create: `tests/unit/notifications/templates.test.ts`

- [ ] **Step 1: Napiši failing test prvi**

```ts
// tests/unit/notifications/templates.test.ts
import { describe, it, expect } from "vitest";
import { renderNewAppointmentEmail } from "@/lib/notifications/templates";

describe("renderNewAppointmentEmail", () => {
  const baseInput = {
    clientName: "Marija Kovač",
    clientPhone: "+38765123456",
    clientEmail: "marija@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-15T16:00:00.000Z"), // 18:00 Sarajevo (CEST UTC+2)
    notes: "Alergija na lateks",
    adminPanelUrl: "https://upbeauty.ba/admin/termini",
  };

  it("subject sadrži ime klijenta, ime usluge i datum", () => {
    const result = renderNewAppointmentEmail(baseInput);
    expect(result.subject).toContain("Marija Kovač");
    expect(result.subject).toContain("Šminkanje");
    expect(result.subject).toMatch(/maj|svibanj/i); // BiH/HR mjesec
  });

  it("HTML body sadrži sva polja", () => {
    const { html } = renderNewAppointmentEmail(baseInput);
    expect(html).toContain("Marija Kovač");
    expect(html).toContain("+38765123456");
    expect(html).toContain("marija@example.com");
    expect(html).toContain("Šminkanje");
    expect(html).toContain("18:00"); // Sarajevo time
    expect(html).toContain("Alergija na lateks");
    expect(html).toContain("https://upbeauty.ba/admin/termini");
  });

  it("text body sadrži sva polja u plain text formatu", () => {
    const { text } = renderNewAppointmentEmail(baseInput);
    expect(text).toContain("Marija Kovač");
    expect(text).toContain("+38765123456");
    expect(text).toContain("Šminkanje");
    expect(text).toContain("18:00");
    expect(text).not.toContain("<"); // no HTML tags
  });

  it("bez email-a klijenta — HTML/text ne prikazuju email row", () => {
    const { html, text } = renderNewAppointmentEmail({
      ...baseInput,
      clientEmail: null,
    });
    expect(html).not.toContain("marija@example.com");
    expect(html).not.toContain("mailto:");
    expect(text).not.toMatch(/Email:/i);
  });

  it("bez napomene — HTML/text ne prikazuju napomena sekciju", () => {
    const { html, text } = renderNewAppointmentEmail({
      ...baseInput,
      notes: null,
    });
    expect(html).not.toContain("Alergija na lateks");
    expect(html).not.toMatch(/Napomena/i);
    expect(text).not.toMatch(/Napomena/i);
  });
});
```

- [ ] **Step 2: Run test — mora fail-ovati**

Run: `cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && npm test -- templates`
Expected: FAIL sa "Cannot find module @/lib/notifications/templates".

- [ ] **Step 3: Napiši implementaciju**

```ts
// src/lib/notifications/templates.ts
import { formatInTimeZone } from "date-fns-tz";

/**
 * Input za rendere email-a "Nova rezervacija".
 */
export type NewAppointmentEmailInput = {
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceName: string;
  startTime: Date;
  notes: string | null;
  adminPanelUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const TZ = "Europe/Sarajevo";

// Domaći nazivi mjeseci za "Pet, 15. maj 2026."
const MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
] as const;
const DAYS_SHORT = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"] as const;

function formatDateSr(date: Date): string {
  // "Pet, 15. maj 2026."
  const zonedFormatted = formatInTimeZone(date, TZ, "yyyy-MM-dd HH:mm");
  // Parsuj iz zoned string-a da dobijemo Date u Sarajevo komponentama
  const [datePart] = zonedFormatted.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const dayOfWeek = new Date(zonedFormatted).getDay();
  return `${DAYS_SHORT[dayOfWeek]}, ${day}. ${MONTHS[month - 1]} ${year}.`;
}

function formatTimeSr(date: Date): string {
  return formatInTimeZone(date, TZ, "HH:mm");
}

export function renderNewAppointmentEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const { clientName, clientPhone, clientEmail, serviceName, startTime, notes, adminPanelUrl } = input;
  const dateLabel = formatDateSr(startTime);
  const timeLabel = formatTimeSr(startTime);

  const subject = `Nova rezervacija: ${clientName} — ${serviceName} (${dateLabel})`;

  const html = `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#fdfbf9;font-family:Georgia,'Times New Roman',serif;color:#5a4545;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fdfbf9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:#ffffff;border:1px solid #f0e6dd;">
        <tr><td style="padding:32px 32px 16px 32px;border-bottom:1px solid #f0e6dd;">
          <div style="font-size:14px;letter-spacing:0.25em;text-transform:uppercase;color:#b8965a;font-weight:600;">UP Beauty Studio</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px 0;font-size:28px;font-style:italic;font-weight:normal;color:#3d2b2b;">Nova rezervacija</h1>
          <div style="width:48px;height:2px;background:#c4787a;margin-bottom:24px;"></div>

          <h2 style="margin:24px 0 8px 0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#887070;font-weight:600;">Klijent</h2>
          <div style="font-size:16px;color:#3d2b2b;margin-bottom:4px;">${escapeHtml(clientName)}</div>
          <div style="font-size:14px;"><a href="tel:${encodeURIComponent(clientPhone)}" style="color:#c4787a;text-decoration:none;">${escapeHtml(clientPhone)}</a></div>
          ${clientEmail ? `<div style="font-size:14px;margin-top:4px;"><a href="mailto:${encodeURIComponent(clientEmail)}" style="color:#c4787a;text-decoration:none;">${escapeHtml(clientEmail)}</a></div>` : ""}

          <h2 style="margin:32px 0 8px 0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#887070;font-weight:600;">Termin</h2>
          <div style="font-size:16px;color:#3d2b2b;margin-bottom:4px;">${escapeHtml(serviceName)}</div>
          <div style="font-size:14px;color:#5a4545;">${escapeHtml(dateLabel)}</div>
          <div style="font-size:14px;color:#5a4545;">${escapeHtml(timeLabel)}</div>

          ${notes ? `<h2 style="margin:32px 0 8px 0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#887070;font-weight:600;">Napomena</h2><div style="font-size:14px;font-style:italic;color:#5a4545;">"${escapeHtml(notes)}"</div>` : ""}

          <div style="margin-top:40px;">
            <a href="${adminPanelUrl}" style="display:inline-block;background:#b8965a;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;">Otvori u admin panelu</a>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #f0e6dd;font-size:12px;color:#887070;">
          UP Beauty &amp; Makeup Studio<br>
          Majora Milana Tepića 13, Gradiška
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `NOVA REZERVACIJA — UP Beauty Studio

Klijent: ${clientName}
Telefon: ${clientPhone}${clientEmail ? `\nEmail: ${clientEmail}` : ""}

Termin: ${serviceName}
Datum: ${dateLabel}
Vrijeme: ${timeLabel}
${notes ? `\nNapomena: ${notes}\n` : ""}
Otvori u admin panelu:
${adminPanelUrl}

--
UP Beauty & Makeup Studio
Majora Milana Tepića 13, Gradiška
`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 4: Run test — mora pass-ovati**

Run: `npm test -- templates`
Expected: 5 testova pass.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/templates.ts tests/unit/notifications/templates.test.ts
git commit -m "feat(notifications): templates.ts — HTML+text renderer za 'Nova rezervacija'

Pure funkcija sa input objektom, vraća { subject, html, text }. Sarajevo
TZ formatting, escapeHtml za XSS-safe injection, 5 Vitest unit testova
pokrivaju full data + optional fields (clientEmail, notes)."
```

---

### Task 1.4: send-admin-email.ts + testovi (TDD)

**Files:**
- Create: `src/lib/notifications/send-admin-email.ts`
- Create: `tests/unit/notifications/send-admin-email.test.ts`

- [ ] **Step 1: Napiši failing testove**

```ts
// tests/unit/notifications/send-admin-email.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendNewAppointmentEmail } from "@/lib/notifications/send-admin-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe("sendNewAppointmentEmail", () => {
  const baseInput = {
    clientName: "Test Klijent",
    clientPhone: "+38765000000",
    clientEmail: null,
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-15T16:00:00.000Z"),
    notes: null,
    adminPanelUrl: "https://upbeauty.ba/admin/termini",
  };

  beforeEach(() => {
    mockSend.mockReset();
    _resetResendClientForTests();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("RESEND_FROM_EMAIL", "rezervacije@upbeauty.ba");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "una@example.com");
  });

  it("poziva Resend send sa pravim parametrima kada su env vars set", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });

    await sendNewAppointmentEmail(baseInput);

    expect(mockSend).toHaveBeenCalledOnce();
    const args = mockSend.mock.calls[0][0];
    expect(args.from).toBe("rezervacije@upbeauty.ba");
    expect(args.to).toEqual(["una@example.com"]);
    expect(args.subject).toContain("Test Klijent");
    expect(args.html).toContain("Test Klijent");
    expect(args.text).toContain("Test Klijent");
  });

  it("ne baca error niti poziva Resend kada RESEND_API_KEY nije set", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    _resetResendClientForTests();

    await expect(sendNewAppointmentEmail(baseInput)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("ne baca error kada Resend API vrati error", async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Domain not verified", name: "validation_error" },
    });

    await expect(sendNewAppointmentEmail(baseInput)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("ne baca error kada Resend send throw-uje (network error)", async () => {
    mockSend.mockRejectedValue(new Error("Network timeout"));

    await expect(sendNewAppointmentEmail(baseInput)).resolves.toBeUndefined();
    expect(mockSend).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test — mora fail-ovati**

Run: `npm test -- send-admin-email`
Expected: FAIL sa "Cannot find module @/lib/notifications/send-admin-email".

- [ ] **Step 3: Napiši implementaciju**

```ts
// src/lib/notifications/send-admin-email.ts
import { getResendClient } from "./resend";
import {
  renderNewAppointmentEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { sanitizeError } from "@/lib/utils/log";

/**
 * Šalje email Uni o novoj rezervaciji.
 *
 * Fire-and-log: NIKAD ne throw-uje. Ako Resend nije konfigurisan ili
 * pukne, samo loguje — appointment kod koji nas zove ne fail-uje.
 *
 * Provjerava sve potrebne env vars i graceful-skip-uje ako bilo koja
 * nedostaje (npr. lokalni dev bez Resend account-a).
 */
export async function sendNewAppointmentEmail(
  input: NewAppointmentEmailInput,
): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!fromEmail) {
    console.warn("[email skipped] RESEND_FROM_EMAIL missing");
    return;
  }
  if (!adminEmail) {
    console.warn("[email skipped] ADMIN_NOTIFICATION_EMAIL missing");
    return;
  }

  try {
    const { subject, html, text } = renderNewAppointmentEmail(input);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error("Resend API error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error("sendNewAppointmentEmail unexpected error:", sanitizeError(e));
  }
}
```

- [ ] **Step 4: Run test — mora pass-ovati**

Run: `npm test -- send-admin-email`
Expected: 4 testa pass.

- [ ] **Step 5: Run sve testove + typecheck**

Run: `npm test && npm run typecheck`
Expected: sve pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/send-admin-email.ts tests/unit/notifications/send-admin-email.test.ts
git commit -m "feat(notifications): send-admin-email.ts orchestrator + 4 unit testa

Fire-and-log: NIKAD ne throw-uje. Graceful skip ako env vars missing
(lokalni dev bez Resend account-a). Testovi pokrivaju: happy path,
missing env, Resend API error, network throw."
```

---

### Phase 1 Verify Gate

**Pre nego što idemo na Fazu 2:**

- [ ] **Run cijeli test suite + typecheck + lint:**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -3
npm run lint 2>&1 | tail -5
```
Expected: testovi sve pass (npr. "9 passed"), typecheck clean, lint bez NOVIH errora.

- [ ] **Report korisniku: "Faza 1 gotova. Krenuti na Fazu 2?"**

⛔ Ako bilo koji review ili test nije pass — Faza 1 NIJE završena, ne ide se dalje.

---

## Phase 2 — Integration (zakači na createAppointment server action)

Cilj: dodavanje fire-and-log poziva u postojeću `createAppointment` funkciju.

**Phase 2 done when:**
- ✅ `npm run build` pass
- ✅ Manuelni test prolazi (rezervacija kroz `/zakazi` na lokalu → log "[email skipped] RESEND_API_KEY missing" jer lokalno nema key)
- ✅ Spec + code review approved

---

### Task 2.1: Hook u zakazi/actions.ts

**Files:**
- Modify: `src/app/zakazi/actions.ts` (linija ~133, dodaje import + trigger nakon INSERT-a)

**Strategija:** trigger ide između INSERT-a i `redirect()`-a. Async fire-and-log koji NE blokira redirect.

- [ ] **Step 1: Dodaj import na vrhu fajla**

Trenutni imports (lines 1-12):
```ts
"use server";
import { addMinutes, differenceInHours } from "date-fns";
import { redirect } from "next/navigation";
import { bookingFormSchema } from "@/lib/booking/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/utils/phone";
import { isGridAligned } from "@/lib/utils/grid";
import { parseBookingSettings } from "@/lib/settings/read";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { sanitizeError } from "@/lib/utils/log";
import { headers } from "next/headers";
```

Dodaj ispod (lines 12+):
```ts
import { sendNewAppointmentEmail } from "@/lib/notifications/send-admin-email";
```

- [ ] **Step 2: Dodaj trigger nakon INSERT-a**

Trenutno na liniji ~133 stoji:
```ts
  // TODO(Phase 8): sendNewAppointmentEmail(inserted, service, parsed.data)

  redirect(`/zakazi/uspjesno?token=${confirmationToken}`);
}
```

Zamijeni sa:
```ts
  // Fire-and-log email obavještenje Uni — NE blokira redirect.
  // Ako Resend pukne, appointment je već persisted u DB.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://upbeauty.ba";
  void sendNewAppointmentEmail({
    clientName: parsed.data.client_name,
    clientPhone: normalizePhone(parsed.data.client_phone),
    clientEmail: parsed.data.client_email || null,
    serviceName: service.name,
    startTime: start,
    notes: parsed.data.notes || null,
    adminPanelUrl: `${siteUrl}/admin/termini`,
  });

  redirect(`/zakazi/uspjesno?token=${confirmationToken}`);
}
```

**Napomena:** `void` prefix javlja TypeScript-u da nas ne zanima return — promise se rezolviše u pozadini, kod ide dalje. `redirect()` će se izvršiti odmah.

- [ ] **Step 3: Verify typecheck + build**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm run typecheck
npm run build 2>&1 | tail -8
```
Expected: oba pass.

- [ ] **Step 4: Manuelni test (lokalno)**

Predpostavlja dev server radi na portu 3000 (`npm run dev`). 

```bash
# U novom terminal-u prati dev logs
tail -f /tmp/up-beauty-dev.log
```

Otvori `http://localhost:3000/zakazi` u browser-u, rezerviši test termin sa imenom "E2E Test Email" (radi cleanup-a). Submitujte.

Expected u dev log-u (jer lokalno NEMA `RESEND_API_KEY`):
```
[email skipped] RESEND_API_KEY missing
```

Ako se to vidi, integracija radi. Rezervacija takođe mora da uspije (redirect na `/zakazi/uspjesno`).

Cleanup test rezervacije (jer "E2E Test*" prefix se obriše automatski next E2E run-om), ili ručno:
```bash
docker exec supabase_db_up-beauty psql -U postgres -d postgres -c "DELETE FROM appointments WHERE client_name LIKE 'E2E Test Email%';"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/zakazi/actions.ts
git commit -m "feat(notifications): hook send-admin-email u createAppointment

Fire-and-log nakon uspješnog INSERT-a, ne blokira redirect. Ako Resend
pukne ili env vars nedostaju, rezervacija je već persisted u DB.
"
```

---

### Phase 2 Verify Gate

- [ ] **Run sve testove + build:**

```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
npm test 2>&1 | tail -5
npm run build 2>&1 | tail -10
```
Expected: testovi pass, build pass.

- [ ] **Manuelni test verifikovan:** Phase 2 step 4 prošao (vidi se log).

- [ ] **Report korisniku: "Faza 2 gotova. Krenuti na Fazu 3?"**

---

## Phase 3 — Production setup + dokumentacija + PR

Cilj: README sa setup uputstvima, finalni push, otvoriti PR.

**Phase 3 done when:**
- ✅ README ima sekciju "Resend email setup"
- ✅ PR otvoren ka main
- ✅ Final code review approved

---

### Task 3.1: README sekcija o Resend setup-u

**Files:**
- Modify: `README.md` (dodaje sekciju "Email notifikacije")

- [ ] **Step 1: Pronađi gdje u README-u dodati**

Run:
```bash
cd "/Users/nmil/Desktop/Una Peranovic/up-beauty"
grep -n "^##" README.md
```
Note: dodaj sekciju "## Email notifikacije" prije "## Testing" sekcije, ili na kraju ako "Testing" ne postoji na tom nivou.

- [ ] **Step 2: Dodaj sekciju u README**

Dodaj sljedeću sekciju (prilagodi poziciju da bude logičan flow):

```markdown
## Email notifikacije (Resend)

Kad klijent rezerviše termin na javnoj `/zakazi` stranici, Una automatski dobija email obavještenje preko [Resend](https://resend.com). Email sadrži ime klijenta, telefon, uslugu, datum/vrijeme i link na admin panel.

### Production setup

1. Kreirati Resend account na https://resend.com
2. Verifikovati domen `upbeauty.ba`:
   - Resend dashboard → Domains → Add Domain → unesi `upbeauty.ba`
   - Resend daje SPF + DKIM DNS records — dodati ih kod hosting providera domena
   - Čekati propagaciju (~10 min) → status mora biti **Verified**
3. Generisati API key: Resend dashboard → API Keys → Create → kopirati
4. Postaviti env varijable na Vercel-u (Project → Settings → Environment Variables, scope: Production):
   - `RESEND_API_KEY=re_xxxxxxxx` (iz koraka 3)
   - `RESEND_FROM_EMAIL=rezervacije@upbeauty.ba` (već u `.env.example`)
   - `ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com` (već u `.env.example`)
5. Redeploy production deploy iz Vercel-a (env var promjene traže redeploy)

### Lokalni development

Bez `RESEND_API_KEY` u `.env.local`, kod radi normalno ali ne šalje stvarne emailove — umjesto toga loguje `[email skipped] RESEND_API_KEY missing` u dev console.

Za stvarni email lokalno: postaviti `RESEND_API_KEY` u `.env.local` (Resend free tier 3000 email/mjesec — sasvim dovoljno za dev).

### Šta se desi ako email pukne

Kod je fire-and-log: rezervacija se uvijek kreira u DB-u, čak i ako Resend API vrati error ili nije konfigurisan. Greška se loguje preko `sanitizeError()` u Vercel logs.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): sekcija 'Email notifikacije (Resend)' sa setup uputstvima"
```

---

### Task 3.2: Push + PR

- [ ] **Step 1: Provjera working tree**

Run: `cd "/Users/nmil/Desktop/Una Peranovic/up-beauty" && git status`
Expected: clean.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feature/resend-admin-email
```

- [ ] **Step 3: Otvori PR**

```bash
gh pr create --base main --head feature/resend-admin-email \
  --title "feat(notifications): Resend email Uni pri novoj rezervaciji" \
  --body "$(cat <<'EOF'
**Spec:** [\`docs/superpowers/specs/2026-05-12-resend-admin-email-design.md\`](https://github.com/stpauli98/Una/blob/feature/resend-admin-email/docs/superpowers/specs/2026-05-12-resend-admin-email-design.md)
**Plan:** [\`docs/superpowers/plans/2026-05-12-resend-admin-email.md\`](https://github.com/stpauli98/Una/blob/feature/resend-admin-email/docs/superpowers/plans/2026-05-12-resend-admin-email.md)

## Summary

Una dobija HTML+text email pri svakoj novoj rezervaciji (status \`ceka\`). Fire-and-log: ako Resend pukne, rezervacija je već u DB-u i admin može vidjeti u panelu.

## Faze (sve completed)

1. **Foundation:** \`resend.ts\` lazy singleton + \`templates.ts\` HTML/text renderer + 9 unit testova
2. **Integration:** trigger u \`zakazi/actions.ts\` (fire-and-log, void prefix)
3. **Production setup:** README sekcija sa Resend setup uputstvima

## Test plan

- [x] 9 Vitest unit testova pass
- [x] Typecheck + build + lint pass
- [x] Lokalni manuelni test: rezervacija kroz \`/zakazi\` → \`[email skipped]\` log u console
- [ ] Production: postaviti RESEND_API_KEY na Vercel-u + redeploy → smoke test rezervacija → Resend dashboard pokazuje sent email

## Šta admin treba uraditi pre merge-a

- [ ] Kreirati Resend account + verifikovati \`upbeauty.ba\` domen
- [ ] Generisati API key
- [ ] Postaviti \`RESEND_API_KEY\` na Vercel-u (Production scope)

(Bez ovog setup-a kod radi normalno, samo ne šalje emailove — log umjesto.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL vraćen.

---

### Phase 3 Verify Gate

- [ ] **Final code review subagent na cijeloj implementaciji.**

- [ ] **Report korisniku:** *"Faza 3 gotova. PR #X otvoren. Setup uputstva u README-u. Prije merge-a admin treba postaviti `RESEND_API_KEY` na Vercel-u."*

---

## Spec Coverage Self-Review

| Spec sekcija | Task |
|---|---|
| `resend.ts` lazy singleton | Task 1.2 |
| `templates.ts` pure render | Task 1.3 |
| `send-admin-email.ts` orchestrator | Task 1.4 |
| Hook u `zakazi/actions.ts` | Task 2.1 |
| Subject format ("Nova rezervacija: ... — ... (...)") | Task 1.3 Step 1+3 |
| HTML body (brand boje, inline CSS) | Task 1.3 Step 3 |
| Text body fallback | Task 1.3 Step 3 |
| Conditional klijent email (samo ako postoji) | Task 1.3 test "bez email-a klijenta" + impl |
| Conditional napomena | Task 1.3 test "bez napomene" + impl |
| Sarajevo TZ datum formatting | Task 1.3 (date-fns-tz formatInTimeZone) |
| Graceful skip ako env missing | Task 1.4 (3 skip granice) |
| Fire-and-log u trigger-u | Task 2.1 (void prefix) |
| Resend API error handling | Task 1.4 test "Resend API vrati error" |
| Network error handling | Task 1.4 test "Resend send throw-uje" |
| README setup dokumentacija | Task 3.1 |
| Phase verify gates | Phase 1/2/3 Verify Gate sections |

Sve spec sekcije pokrivene. Tip consistency: `NewAppointmentEmailInput`/`RenderedEmail` types eksportovani u Task 1.3, korišćeni u Task 1.4 i 2.1.

**Placeholder scan:** sav kod je kompletan. Sve komande sa Expected output-om. Faze imaju jasne "done when" kriterijume i verify gate-ove.
