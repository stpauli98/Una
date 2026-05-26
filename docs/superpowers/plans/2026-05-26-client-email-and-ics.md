# Klijent Confirmation Email + ICS Calendar Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pri svakoj rezervaciji slati confirmation email i admin-u (postojeće) i klijentu (novo), oba sa `.ics` calendar attachment-om koji klijent jednim tap-om dodaje u Apple/Google/Outlook kalendar. Plus fix brand string-ova u email template-u — trenutno se prikazuje "UP Beauty Studio" umjesto novog "UP Makeup".

**Architecture:** Pure ICS string builder (testabilan bez I/O), proširen `templates.ts` sa dodatnim klijentskim render-om (drugačiji ton — acknowledgment umjesto action), novi `send-client-email.ts` orchestrator parallel sa postojećim admin-om. Trigger u `zakazi/actions.ts` poziva oba fire-and-log, sa email-presence guard za klijenta (opciono polje). ICS attachment dodat na obje email-a kao base64 u Resend `attachments` array.

**Tech Stack:** TypeScript strict, `date-fns-tz` (Sarajevo TZ), Resend Node SDK (^4.8.0), Vitest unit testovi, sanitizeError za PII-safe logging.

---

## Arhitekturalne odluke

**Zašto UTC u .ics umjesto VTIMEZONE bloka?**
ICS spec dozvoljava da `DTSTART:20260528T160000Z` (UTC sa `Z` suffix) — sve glavne calendar aplikacije (Apple Calendar, Google Calendar, Outlook) konvertuju u user-local TZ automatski. Alternative je puni `VTIMEZONE` blok sa DST tranzicijama što duplo poveća veličinu i komplikuje testabilnost. UTC approach je RFC 5545 compliant i radi univerzalno.

**Zašto novi orchestrator umjesto extend-uti `send-admin-email.ts`?**
Klijent email ima drugačiji ton, drugačiji recipient resolver (`appointment.client_email` umjesto env var), i drugačiji guard (skip ako klijent ne ostavi email). DRY-jevanje preko parametara bi proizvelo "boolean trap" pattern. Dva orchestrator-a sa zajedničkim ICS helper-om je čistije.

**Zašto attachment a ne inline "Add to Google Calendar" link?**
`.ics` attachment radi univerzalno preko email klijenata. Apple Mail na iPhone-u prikaže event card sa "Add to Calendar" dugmetom; Gmail desktop pokaže inline RSVP panel; Outlook automatski parsira. Inline link bi radio samo za Google Calendar korisnike — ne dovoljno za UP Makeup klijentelu.

---

## File Structure

**Create:**
- `src/lib/notifications/ics.ts` — pure VEVENT string builder, testabilan
- `src/lib/notifications/send-client-email.ts` — orchestrator za klijent confirmation
- `tests/unit/notifications/ics.test.ts` — 6 testova za ICS builder
- `tests/unit/notifications/send-client-email.test.ts` — 3 testa za orchestrator

**Modify:**
- `src/lib/notifications/templates.ts` — (a) fix "UP Beauty Studio" → "UP Makeup", (b) dodati `renderClientConfirmationEmail()` koji koristi isti `NewAppointmentEmailInput` plus zahtjeva `clientEmail !== null`
- `src/lib/notifications/send-admin-email.ts` — dodati `.ics` attachment u Resend payload
- `src/app/zakazi/actions.ts` — dodati `void sendClientConfirmationEmail(...)` pored postojećeg admin trigger-a, samo ako klijent unio email
- `tests/unit/notifications/templates.test.ts` — dodati ~2-3 testa za client template, plus update brand string assertion-a u postojećim admin testovima

---

## Task 1: ICS helper + 6 testova (TDD)

**Files:**
- Create: `src/lib/notifications/ics.ts`
- Create: `tests/unit/notifications/ics.test.ts`

**Step 0: Kreirati branch + checkout u glavni working dir**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git checkout main && git pull origin main && git checkout -b feat/client-email-and-ics
```

Expected: `Switched to a new branch 'feat/client-email-and-ics'`.

- [ ] **Step 1: Napisati failing testove**

Kreiraj `tests/unit/notifications/ics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildIcsContent } from "@/lib/notifications/ics";

describe("buildIcsContent", () => {
  const baseInput = {
    uid: "appt-42@upmakeup.ba",
    start: new Date("2026-05-28T16:00:00.000Z"), // 18:00 Sarajevo CEST
    end: new Date("2026-05-28T17:00:00.000Z"), // 19:00 Sarajevo CEST
    summary: "Šminkanje sa Unom",
    location: "Majora Milana Tepića 13, Gradiška",
    description: "Termin za Test Klijent. Kontakt: +387 65 810 323.",
    organizerName: "UP Makeup",
    organizerEmail: "rezervacije@upmakeup.ba",
  };

  it("vraća validan VCALENDAR sa VEVENT blokom", () => {
    const ics = buildIcsContent(baseInput);
    expect(ics).toMatch(/^BEGIN:VCALENDAR/);
    expect(ics).toMatch(/END:VCALENDAR$/);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("VERSION:2.0");
  });

  it("koristi CRLF line endings (RFC 5545)", () => {
    const ics = buildIcsContent(baseInput);
    // ICS spec zahtjeva CRLF, ne samo LF
    expect(ics.includes("\r\n")).toBe(true);
    // Niti jedan plain LF bez prethodnog CR
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(line.includes("\n")).toBe(false);
    }
  });

  it("emituje DTSTART i DTEND u UTC sa Z suffix-om", () => {
    const ics = buildIcsContent(baseInput);
    expect(ics).toContain("DTSTART:20260528T160000Z");
    expect(ics).toContain("DTEND:20260528T170000Z");
  });

  it("escape-uje zarez, semicolon i newline u tekstualnim poljima", () => {
    const ics = buildIcsContent({
      ...baseInput,
      location: "Adresa, 13; Gradiška",
      description: "Linija 1\nLinija 2",
      summary: 'Šminkanje "VIP"',
    });
    expect(ics).toContain("LOCATION:Adresa\\, 13\\; Gradiška");
    expect(ics).toContain("DESCRIPTION:Linija 1\\nLinija 2");
    // Navodnici se NE escape-uju u ICS-u (samo \, ;, newline)
    expect(ics).toContain('SUMMARY:Šminkanje "VIP"');
  });

  it("sadrži UID i ORGANIZER ako su prosljeđeni", () => {
    const ics = buildIcsContent(baseInput);
    expect(ics).toContain("UID:appt-42@upmakeup.ba");
    expect(ics).toContain("ORGANIZER;CN=UP Makeup:mailto:rezervacije@upmakeup.ba");
  });

  it("organizer je opcioni — preskače blok ako nije prosljeđen", () => {
    const ics = buildIcsContent({
      ...baseInput,
      organizerName: undefined,
      organizerEmail: undefined,
    });
    expect(ics).not.toContain("ORGANIZER");
  });
});
```

- [ ] **Step 2: Pokrenuti test — mora pasti (helper ne postoji)**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/notifications/ics.test.ts
```

Expected: FAIL — `Failed to resolve import "@/lib/notifications/ics"`.

- [ ] **Step 3: Implementirati helper**

Kreiraj `src/lib/notifications/ics.ts`:

```ts
/**
 * iCalendar (.ics) VEVENT builder, RFC 5545 compliant.
 *
 * Generiše standalone VCALENDAR string koji email klijenti (Gmail,
 * Apple Mail, Outlook) prepoznaju kao calendar event attachment —
 * automatski prikazuju "Add to Calendar" CTA bez ručne integracije.
 *
 * Vremena se serijalizuju u UTC sa `Z` suffix-om (npr.
 * `20260528T160000Z`). Calendar aplikacije konvertuju u user-local
 * TZ pri renderu. Alternativa (VTIMEZONE blok sa DST tranzicijama)
 * dvostruko poveća payload i komplikuje testabilnost; UTC pristup
 * je univerzalno podržan.
 */

export type IcsInput = {
  /** Globalno jedinstven UID za event (npr. `appt-<id>@upmakeup.ba`). */
  uid: string;
  /** Start time (UTC instant — Date objekat). */
  start: Date;
  /** End time (UTC instant — mora biti > start). */
  end: Date;
  /** Naslov event-a koji se prikazuje u kalendar UI-ju. */
  summary: string;
  /** Lokacija (adresa). Escape je interni — proslijedi nepromijenjeno. */
  location: string;
  /** Opis event-a (clientName, kontakt). */
  description: string;
  /** Opciono — organizer ime (CN polje). */
  organizerName?: string;
  /** Opciono — organizer email (mailto: target). */
  organizerEmail?: string;
};

/**
 * RFC 5545 zahtjeva escape sljedećih karaktera u TEXT polju:
 *   - backslash `\` → `\\`
 *   - zarez `,` → `\,`
 *   - semicolon `;` → `\;`
 *   - newline (LF/CRLF) → `\n` (literal sa lowercase n)
 *
 * NE escape-uju se: navodnici, quote characters, apostrofi.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** YYYYMMDDTHHMMSSZ format iz Date objekta (UTC). */
function formatIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function buildIcsContent(input: IcsInput): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//UP Makeup//Booking//SR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:REQUEST");
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${input.uid}`);
  lines.push(`DTSTAMP:${formatIcsUtc(new Date())}`);
  lines.push(`DTSTART:${formatIcsUtc(input.start)}`);
  lines.push(`DTEND:${formatIcsUtc(input.end)}`);
  lines.push(`SUMMARY:${escapeIcsText(input.summary)}`);
  lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  if (input.organizerName && input.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${input.organizerName}:mailto:${input.organizerEmail}`,
    );
  }
  lines.push("STATUS:CONFIRMED");
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
```

- [ ] **Step 4: Pokrenuti test — mora proći**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/notifications/ics.test.ts
```

Expected: 6/6 testova pass.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Expected: bez grešaka.

- [ ] **Step 6: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/lib/notifications/ics.ts tests/unit/notifications/ics.test.ts && git commit -m "feat(notifications): add ICS calendar attachment builder + 6 unit testova"
```

---

## Task 2: Brand fix + .ics attachment na admin email

**Files:**
- Modify: `src/lib/notifications/templates.ts` (brand strings)
- Modify: `src/lib/notifications/send-admin-email.ts` (attachment)
- Modify: `tests/unit/notifications/templates.test.ts` (update brand assertions ako postoje)

- [ ] **Step 1: Pronaći stare brand string-ove u templates.ts**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -n "UP Beauty\|upbeauty" src/lib/notifications/templates.ts
```

Očekivano: vidiš jedan ili više pojavljivanja "UP Beauty Studio" / "UP BEAUTY STUDIO" / "UP Beauty & Makeup Studio".

- [ ] **Step 2: Zamijeniti u templates.ts**

Otvori `src/lib/notifications/templates.ts`. Za svaki nađeni:
- "UP BEAUTY STUDIO" → "UP MAKEUP"
- "UP Beauty Studio" → "UP Makeup"
- "UP Beauty & Makeup Studio" → "UP Makeup Studio"

Verifikuj sa:

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -n "UP Beauty\|UP BEAUTY" src/lib/notifications/templates.ts
```

Očekivano: nema više pogodaka.

- [ ] **Step 3: Provjeriti postojeće testove**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && grep -n "UP Beauty\|UP BEAUTY" tests/unit/notifications/templates.test.ts
```

Ako test asertira na "UP Beauty" string, ažuriraj asercije na "UP Makeup".

- [ ] **Step 4: Otvoriti `send-admin-email.ts` i dodati attachment**

Trenutno je struktura:

```ts
const result = await resend.emails.send({
  from: fromEmail,
  to: [adminEmail],
  subject,
  html,
  text,
});
```

Treba postati:

```ts
const result = await resend.emails.send({
  from: fromEmail,
  to: [adminEmail],
  subject,
  html,
  text,
  attachments: [
    {
      filename: "rezervacija.ics",
      content: Buffer.from(icsContent, "utf-8").toString("base64"),
    },
  ],
});
```

Plus dodati import + izračunavanje icsContent. Cijeli izmijenjeni fajl (sa svim postojećim guards-ima):

```ts
import { getResendClient } from "./resend";
import {
  renderNewAppointmentEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { buildIcsContent } from "./ics";
import { sanitizeError } from "@/lib/utils/log";

const APPOINTMENT_DURATION_MIN_DEFAULT = 60;

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

    // ICS attachment — admin može dodati event direktno u svoj kalendar
    const endTime = new Date(
      input.startTime.getTime() + APPOINTMENT_DURATION_MIN_DEFAULT * 60_000,
    );
    const icsContent = buildIcsContent({
      uid: `appt-${input.startTime.getTime()}@upmakeup.ba`,
      start: input.startTime,
      end: endTime,
      summary: `${input.serviceName} — ${input.clientName}`,
      location: "Majora Milana Tepića 13, Gradiška",
      description: `Klijent: ${input.clientName}\nTelefon: ${input.clientPhone}${input.notes ? `\nNapomena: ${input.notes}` : ""}`,
      organizerName: "UP Makeup",
      organizerEmail: fromEmail,
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject,
      html,
      text,
      attachments: [
        {
          filename: "rezervacija.ics",
          content: Buffer.from(icsContent, "utf-8").toString("base64"),
        },
      ],
    });

    if (result.error) {
      console.error("Resend API error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error("sendNewAppointmentEmail unexpected error:", sanitizeError(e));
  }
}
```

Zašto `APPOINTMENT_DURATION_MIN_DEFAULT = 60`? `NewAppointmentEmailInput` ne sadrži explicitno end time — postojeći flow šalje samo start. Default trajanje od 60 min je preprodukcijski safe (većina usluga u BOOKING_RULES je 60min). Buduće poboljšanje: dodati `durationMin` u input. Za sada konstanta na vrhu fajla služi kao single source of truth.

- [ ] **Step 5: Pokrenuti postojeće testove za admin email**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/notifications/
```

Expected: svi prethodni testovi prolaze + 6 novih ICS testova. Ako koji od admin email testova fail-uje zbog brand string-a (npr. `expect(...).toContain("UP Beauty")` koji više ne pase), update-uj asercije.

- [ ] **Step 6: Typecheck + build sanity**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Expected: bez grešaka.

- [ ] **Step 7: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/lib/notifications/templates.ts src/lib/notifications/send-admin-email.ts tests/unit/notifications/templates.test.ts && git commit -m "feat(notifications): brand fix UP Beauty → UP Makeup + .ics attachment u admin emailu"
```

---

## Task 3: Client confirmation template + orchestrator + trigger

**Files:**
- Modify: `src/lib/notifications/templates.ts` (dodati `renderClientConfirmationEmail`)
- Create: `src/lib/notifications/send-client-email.ts`
- Create: `tests/unit/notifications/send-client-email.test.ts`
- Modify: `src/app/zakazi/actions.ts` (dodati trigger)

- [ ] **Step 1: Dodati client template u `templates.ts`**

Otvori `src/lib/notifications/templates.ts`. Već postoji `renderNewAppointmentEmail` koji dijeli `formatDateSr` helper. Dodati novi export ISPOD postojećeg:

```ts
/**
 * Render-uje confirmation email NAMIJENJEN KLIJENTU — drugačiji ton od
 * admin notifikacije ("Vaša rezervacija je primljena" umjesto "Nova
 * rezervacija stigla"). Spec: friendly acknowledgment + datum/vrijeme
 * + adresa za dolazak + kontakt za otkazivanje + napomena o .ics
 * attachment-u.
 */
export function renderClientConfirmationEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const dateStr = formatDateSr(input.startTime);
  const timeStr = formatInTimeZone(input.startTime, TZ, "HH:mm");

  const subject = `Vaša rezervacija — ${input.serviceName}, ${dateStr} u ${timeStr}`;

  const html = `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A2A2A;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#C4787A;margin:0 0 8px 0;">UP MAKEUP</h1>
  <h2 style="font-size:24px;font-weight:400;color:#2A2A2A;margin:0 0 24px 0;">Vaša rezervacija je primljena</h2>

  <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;">Hvala vam, <strong>${escapeHtml(input.clientName)}</strong>. Una će potvrditi vašu rezervaciju u najkraćem roku.</p>

  <div style="background:#fff;border:1px solid #EDE7DF;padding:20px;margin:24px 0;">
    <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8A8580;">Termin</p>
    <p style="margin:0 0 4px 0;font-size:18px;font-weight:500;">${escapeHtml(input.serviceName)}</p>
    <p style="margin:0 0 4px 0;font-size:15px;">${dateStr}</p>
    <p style="margin:0 0 16px 0;font-size:15px;">${timeStr}</p>

    <p style="margin:16px 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8A8580;">Adresa</p>
    <p style="margin:0;font-size:14px;">Majora Milana Tepića 13, Gradiška</p>
  </div>

  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 16px 0;">📅 U prilogu je <code style="background:#EDE7DF;padding:2px 6px;font-size:12px;">.ics</code> fajl — otvorite ga na telefonu/računaru da dodate termin u svoj kalendar.</p>

  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 32px 0;">Ako trebate otkazati ili pomjeriti, javite na <a href="tel:+38765810323" style="color:#C4787A;text-decoration:none;">+387 65 810 323</a>.</p>

  <hr style="border:none;border-top:1px solid #EDE7DF;margin:24px 0;">
  <p style="font-size:11px;color:#8A8580;text-align:center;margin:0;">UP Makeup · Majora Milana Tepića 13, Gradiška</p>
</div>
</body>
</html>`;

  const text = `UP MAKEUP — Vaša rezervacija je primljena

Hvala vam, ${input.clientName}. Una će potvrditi vašu rezervaciju u najkraćem roku.

TERMIN
${input.serviceName}
${dateStr}
${timeStr}

ADRESA
Majora Milana Tepića 13, Gradiška

U prilogu je .ics fajl — otvorite ga da dodate termin u svoj kalendar.

Ako trebate otkazati ili pomjeriti, javite na +387 65 810 323.

UP Makeup`;

  return { subject, html, text };
}
```

Provjeri da `escapeHtml` već postoji u templates.ts (vjerovatno da, koristi se u admin template-u). Ako nema, dodaj jednolinijski helper:

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 2: Dodati testove za client template**

Otvori `tests/unit/notifications/templates.test.ts` i dodaj na kraj fajla:

```ts
import { renderClientConfirmationEmail } from "@/lib/notifications/templates";

describe("renderClientConfirmationEmail", () => {
  const baseInput = {
    clientName: "Marko Marković",
    clientPhone: "+387 65 000 000",
    clientEmail: "marko@example.com",
    serviceName: "Šminkanje",
    startTime: new Date("2026-05-28T16:00:00.000Z"), // 18:00 Sarajevo CEST
    notes: null,
    adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
  };

  it("subject sadrži uslugu, datum i vrijeme u Sarajevo TZ", () => {
    const { subject } = renderClientConfirmationEmail(baseInput);
    expect(subject).toContain("Šminkanje");
    expect(subject).toContain("18:00");
    expect(subject).toMatch(/maj 2026/);
  });

  it("HTML escape-uje korisničke karaktere", () => {
    const { html } = renderClientConfirmationEmail({
      ...baseInput,
      clientName: 'Marko "&" Petrović',
    });
    expect(html).toContain("&quot;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain('"&"');
  });

  it("text body je friendly acknowledgment ton (ne 'Nova rezervacija')", () => {
    const { text } = renderClientConfirmationEmail(baseInput);
    expect(text).toContain("Vaša rezervacija");
    expect(text).toContain("Hvala vam");
    expect(text).not.toContain("Nova rezervacija");
  });
});
```

- [ ] **Step 3: Pokrenuti testove**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/notifications/templates.test.ts
```

Expected: postojeći testovi + 3 nova prolaze.

- [ ] **Step 4: Kreirati `send-client-email.ts` orchestrator**

Kreiraj `src/lib/notifications/send-client-email.ts`:

```ts
import { getResendClient } from "./resend";
import {
  renderClientConfirmationEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { buildIcsContent } from "./ics";
import { sanitizeError } from "@/lib/utils/log";

const APPOINTMENT_DURATION_MIN_DEFAULT = 60;

/**
 * Šalje confirmation email klijentu pri novoj rezervaciji.
 *
 * Fire-and-log: NIKAD ne throw-uje. Ako Resend nije konfigurisan, ako
 * klijent nije ostavio email, ili ako send fail-uje — samo loguje,
 * appointment kod nas ne fail-uje.
 *
 * Razlika od `sendNewAppointmentEmail` (admin):
 *   - Recipient je `input.clientEmail` umjesto env var-a
 *   - Skip-uje ako `clientEmail === null` (email je opciono polje u
 *     booking formi — neki klijenti daju samo telefon)
 *   - Template je friendly acknowledgment (Vaša rezervacija je primljena)
 *     umjesto action notifikacije
 *
 * Oba dijele isti `.ics` attachment generator.
 */
export async function sendClientConfirmationEmail(
  input: NewAppointmentEmailInput,
): Promise<void> {
  if (!input.clientEmail) {
    // Klijent nije ostavio email — skip silently (očekivano, ne loguj).
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn("[client email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[client email skipped] RESEND_FROM_EMAIL missing");
    return;
  }

  try {
    const { subject, html, text } = renderClientConfirmationEmail(input);

    const endTime = new Date(
      input.startTime.getTime() + APPOINTMENT_DURATION_MIN_DEFAULT * 60_000,
    );
    const icsContent = buildIcsContent({
      uid: `appt-${input.startTime.getTime()}@upmakeup.ba`,
      start: input.startTime,
      end: endTime,
      summary: `${input.serviceName} — UP Makeup`,
      location: "Majora Milana Tepića 13, Gradiška",
      description: `Termin: ${input.serviceName}. Adresa: Majora Milana Tepića 13, Gradiška. Kontakt: +387 65 810 323.`,
      organizerName: "UP Makeup",
      organizerEmail: fromEmail,
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.clientEmail],
      subject,
      html,
      text,
      attachments: [
        {
          filename: "rezervacija.ics",
          content: Buffer.from(icsContent, "utf-8").toString("base64"),
        },
      ],
    });

    if (result.error) {
      console.error("Resend client email API error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error(
      "sendClientConfirmationEmail unexpected error:",
      sanitizeError(e),
    );
  }
}
```

- [ ] **Step 5: Dodati testove za `send-client-email.ts`**

Kreiraj `tests/unit/notifications/send-client-email.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendClientConfirmationEmail } from "@/lib/notifications/send-client-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const baseInput = {
  clientName: "Test Klijent",
  clientPhone: "+387 65 000 000",
  clientEmail: "test@example.com",
  serviceName: "Šminkanje",
  startTime: new Date("2026-05-28T16:00:00.000Z"),
  notes: null,
  adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
};

describe("sendClientConfirmationEmail", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetResendClientForTests();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("skip-uje silently ako klijent nije ostavio email", async () => {
    await sendClientConfirmationEmail({ ...baseInput, clientEmail: null });
    // NE smije logovati skip (klijent bez email-a je expected case, ne anomalija)
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("loguje 'RESEND_API_KEY missing' ako klijent ima email ali server nije konfigurisan", async () => {
    await sendClientConfirmationEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith(
      "[client email skipped] RESEND_API_KEY missing",
    );
  });

  it("loguje 'RESEND_FROM_EMAIL missing' kad API key postoji ali FROM nedostaje", async () => {
    process.env.RESEND_API_KEY = "re_test";
    await sendClientConfirmationEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith(
      "[client email skipped] RESEND_FROM_EMAIL missing",
    );
  });
});
```

- [ ] **Step 6: Pokrenuti nove testove**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test -- tests/unit/notifications/send-client-email.test.ts
```

Expected: 3/3 prolaze.

- [ ] **Step 7: Dodati trigger u `zakazi/actions.ts`**

Otvori `src/app/zakazi/actions.ts`. Postojeća struktura ima `void sendNewAppointmentEmail(...)` blok. Pronaći ga:

```bash
grep -n "sendNewAppointmentEmail" src/app/zakazi/actions.ts
```

Pored postojećeg poziva, dodati paralelni client trigger. Na vrhu fajla dodati import:

```ts
import { sendClientConfirmationEmail } from "@/lib/notifications/send-client-email";
```

Ispod postojećeg `void sendNewAppointmentEmail({...})` dodati:

```ts
    void sendClientConfirmationEmail({
      clientName: parsed.data.client_name,
      clientPhone: normalizedPhone,
      clientEmail: parsed.data.client_email ?? null,
      serviceName: service.name,
      startTime: appointmentDate,
      notes: parsed.data.notes ?? null,
      adminPanelUrl,
    });
```

(Imena varijabli match-uju postojeći admin call — `appointmentDate`, `service.name`, `parsed.data.*`, `normalizedPhone`, `adminPanelUrl` su već u scope-u jer admin email koristi ih.)

- [ ] **Step 8: Pokrenuti pun unit test suite**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm test
```

Expected: svi testovi prolaze (baseline + 6 ics + 3 send-client-email + ~3 nova template testa).

- [ ] **Step 9: Typecheck**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run typecheck
```

Expected: bez grešaka.

- [ ] **Step 10: Commit**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git add src/lib/notifications/templates.ts src/lib/notifications/send-client-email.ts tests/unit/notifications/templates.test.ts tests/unit/notifications/send-client-email.test.ts src/app/zakazi/actions.ts && git commit -m "feat(notifications): client confirmation email + .ics calendar attachment"
```

---

## Task 4: Verify + Push + PR

- [ ] **Step 1: Production build**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && npm run build
```

Expected: build prolazi bez grešaka. Provjeriti da `/zakazi` ruta i dalje generiše.

- [ ] **Step 2: Push branch**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && git push -u origin feat/client-email-and-ics
```

- [ ] **Step 3: Kreirati PR**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && gh pr create --base main --head feat/client-email-and-ics --title "feat(notifications): client confirmation email + .ics calendar attachment" --body "$(cat <<'EOF'
## Summary

- Klijent sad dobija confirmation email sa svojim terminom — istom flow-u kao admin notifikacija (fire-and-log, ne blokira booking).
- Oba email-a (admin + klijent) imaju .ics attachment koji email klijenti (Gmail/Apple Mail/Outlook) auto-prepoznaju i nude 'Add to Calendar' jedan-tap.
- Brand fix: 'UP Beauty Studio' → 'UP Makeup' u template-u (commit 1820f2d rebrand nije bio kompletan).

## Arhitekturalne odluke

- ICS u UTC sa Z suffix-om umjesto VTIMEZONE blok — sve calendar aplikacije konvertuju u user-local TZ automatski; UTC payload je 50% manji i lakši za testiranje.
- Novi `send-client-email.ts` orchestrator (umjesto extend-uti admin sa boolean trap) — drugačiji ton/recipient/guard. Dijele ICS helper.
- `clientEmail === null` → skip silently bez log-a (opciono polje, expected case).

## Promjene

- \`src/lib/notifications/ics.ts\` (novi, RFC 5545 compliant builder)
- \`src/lib/notifications/send-client-email.ts\` (novi, parallel sa admin orchestrator)
- \`src/lib/notifications/templates.ts\` — \`renderClientConfirmationEmail\` + brand fix
- \`src/lib/notifications/send-admin-email.ts\` — dodato \`.ics\` attachment
- \`src/app/zakazi/actions.ts\` — trigger pored postojećeg admin-a
- 3 nova test fajla (ics, send-client-email, templates expansion) — ukupno 12 novih testova

## Test plan

- [x] \`npm test\` — svi prethodni + ~12 novih
- [x] \`npm run typecheck\` — clean
- [x] \`npm run build\` — clean
- [ ] **Manual smoke** na produkciji (nakon merge-a + Vercel deploy):
  1. Test rezervacija sa email-om → klijent treba da dobije email \"Vaša rezervacija primljena\" sa .ics attachment-om
  2. Test rezervacija BEZ email-a → admin dobija email, klijent ne (skip silently)
  3. Klik na .ics attachment u Apple Mail → 'Add to Calendar' prompt
  4. Klik na .ics attachment u Gmail desktop → inline RSVP panel
  5. Calendar event ima ispravan start time u Sarajevo TZ (18:00 ako je rezervisano 18:00 Sarajevo)
  6. Admin email i dalje radi kako prije, sad i sa .ics attachment-om

## Out of scope (za buduće PR-ove)

- Email reminder 24h prije termina — ova grupa je samo immediate confirmation
- Cancellation email kad admin otkaže — slično pattern-u, ali zaseban scope
- RSVP / Cancellation link u client email-u — sad samo 'javite na telefon'
EOF
)"
```

- [ ] **Step 4: Verifikovati PR**

```bash
cd /Users/nmil/Desktop/Una\ Peranovic/up-beauty && gh pr view --json url,mergeable,mergeStateStatus --jq '"\(.url) [\(.mergeable) | \(.mergeStateStatus)]"'
```

---

## Out of scope (za odvojen razgovor)

- **Reminder email 24h prije termina** — Resend cron + queue treba, veći obim
- **Cancellation/reschedule email** — admin akcija + email; jasan pattern ali zaseban scope
- **Email open/click tracking u Resend dashboard-u** — opt-in, ne treba sad
- **Multi-language email** (BS/EN) — ako Una želi engleski za turiste; treba i18n
- **Per-service duration u .ics** — sad hardkodirano 60min default. Buduće: dodati `durationMin` u `NewAppointmentEmailInput` i izvuci iz services tabele

---

## Self-Review

**Spec coverage:**
- Klijent email: ✓ Task 3 (template + orchestrator + trigger)
- ICS attachment u oba email-a: ✓ Task 1 (helper) + Task 2 (admin attach) + Task 3 (client attach)
- Brand fix: ✓ Task 2 Steps 1-3
- Skip ako klijent nema email: ✓ Task 3 send-client-email.ts + test

**Placeholder scan:** Pretražio plan za "TODO", "TBD", "implement later", "Similar to" — nema. Sve komande i kod blokovi eksplicitni.

**Type consistency:**
- `IcsInput` (Task 1) → koristi `Date` za start/end. Task 2/3 prosljeđuju Date objekte iz `input.startTime`. ✓
- `NewAppointmentEmailInput` (već postoji) → ima `clientName`, `clientPhone`, `clientEmail`, `serviceName`, `startTime`, `notes`, `adminPanelUrl`. Task 3 koristi sve. ✓
- `renderClientConfirmationEmail` returnuje `RenderedEmail` ({subject, html, text}). send-client-email.ts destructure-uje to. ✓
- `buildIcsContent` returnuje string. send-* orchestrator-i ga base64-uju. ✓
