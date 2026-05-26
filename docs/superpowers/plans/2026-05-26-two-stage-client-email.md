# Two-Stage Client Email + Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restruktuirati client email flow iz PR #60: odmah šalje "primljeno" (bez .ics), .ics tek kad Una potvrdi, plus cancellation email kad Una otkaže. Pokriva i manual booking.

**Architecture:** Nastavak na branch `feat/client-email-and-ics` (PR #60). Proširiti ICS builder sa METHOD/STATUS parametrima. 3 nova template rendera u templates.ts. 2 nova orchestratora (booking-received + cancellation). Rewire 4 server action triggera: zakazi (booking received umjesto confirmation), confirmAppointment, cancelAppointment, createManualAppointment.

**Tech Stack:** TypeScript strict, Resend SDK, `date-fns-tz`, Vitest, Next.js 16 `after()` za fire-and-log.

**Spec:** `docs/superpowers/specs/2026-05-26-two-stage-client-email-design.md`

---

## File Structure

**Create:**
- `src/lib/notifications/send-booking-received-email.ts` — lightweight orchestrator, bez .ics
- `src/lib/notifications/send-cancellation-email.ts` — orchestrator sa `previousStatus` kontekstom
- `tests/unit/notifications/send-booking-received-email.test.ts`
- `tests/unit/notifications/send-cancellation-email.test.ts`

**Modify:**
- `src/lib/notifications/ics.ts` — opcioni `method` + `status` parametri na `IcsInput`
- `src/lib/notifications/templates.ts` — 3 nova rendera + modifikovati confirmation subject
- `src/app/zakazi/actions.ts` — zamijeniti `sendClientConfirmationEmail` sa `sendBookingReceivedEmail`
- `src/app/admin/(protected)/termini/actions.ts` — dodati email triggere u confirmAppointment, cancelAppointment, createManualAppointment
- `tests/unit/notifications/ics.test.ts` — 2 nova testa za CANCEL
- `tests/unit/notifications/templates.test.ts` — testovi za 3 nova rendera

---

## Task 1: ICS builder extension — METHOD + STATUS parametri

**Files:**
- Modify: `src/lib/notifications/ics.ts`
- Modify: `tests/unit/notifications/ics.test.ts`

- [ ] **Step 1: Dodati 2 failing testa na kraj ics.test.ts**

```ts
it("podržava METHOD:CANCEL i STATUS:CANCELLED za otkazivanje", () => {
  const ics = buildIcsContent({
    ...baseInput,
    method: "CANCEL",
    status: "CANCELLED",
  });
  expect(ics).toContain("METHOD:CANCEL");
  expect(ics).toContain("STATUS:CANCELLED");
  expect(ics).not.toContain("METHOD:REQUEST");
  expect(ics).not.toContain("STATUS:CONFIRMED");
});

it("default method=REQUEST i status=CONFIRMED kad nisu prosljeđeni", () => {
  const ics = buildIcsContent(baseInput);
  expect(ics).toContain("METHOD:REQUEST");
  expect(ics).toContain("STATUS:CONFIRMED");
});
```

- [ ] **Step 2: Run tests — 2 nova fail-uju** (STATUS:CONFIRMED radi ali METHOD je hardkodovan)

```bash
npm test -- tests/unit/notifications/ics.test.ts
```

- [ ] **Step 3: Proširiti `IcsInput` tip i `buildIcsContent` u ics.ts**

Na `IcsInput` dodati:

```ts
/** ICS method — REQUEST za novi event, CANCEL za brisanje. Default: REQUEST. */
method?: "REQUEST" | "CANCEL";
/** ICS event status. Default: CONFIRMED. */
status?: "CONFIRMED" | "CANCELLED";
```

U `buildIcsContent`, zamijeniti hardkodirane linije:

```ts
// Staro:
lines.push("METHOD:REQUEST");
// ...
lines.push("STATUS:CONFIRMED");

// Novo:
lines.push(`METHOD:${input.method ?? "REQUEST"}`);
// ...
lines.push(`STATUS:${input.status ?? "CONFIRMED"}`);
```

- [ ] **Step 4: Run tests — svi prolaze**

```bash
npm test -- tests/unit/notifications/ics.test.ts
```

Expected: 8/8 (6 + 2 nova).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/ics.ts tests/unit/notifications/ics.test.ts && git commit -m "feat(ics): add optional method + status params for cancel support"
```

---

## Task 2: Novi templates + modificiran confirmation subject

**Files:**
- Modify: `src/lib/notifications/templates.ts`
- Modify: `tests/unit/notifications/templates.test.ts`

- [ ] **Step 1: Dodati `renderBookingReceivedEmail` u templates.ts**

Ispod postojećeg `renderClientConfirmationEmail`, dodati:

```ts
export function renderBookingReceivedEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const dateStr = formatDateSr(input.startTime);
  const timeStr = formatInTimeZone(input.startTime, TZ, "HH:mm");

  const subject = `Primili smo vašu rezervaciju — ${input.serviceName}, ${dateStr}`;

  const html = `<!DOCTYPE html>
<html lang="sr"><head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A2A2A;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#C4787A;margin:0 0 8px 0;">UP MAKEUP</h1>
  <h2 style="font-size:24px;font-weight:400;margin:0 0 24px 0;">Primili smo vašu rezervaciju</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;">Hvala vam, <strong>${escapeHtml(input.clientName)}</strong>.</p>
  <div style="background:#fff;border:1px solid #EDE7DF;padding:20px;margin:24px 0;">
    <p style="margin:0 0 4px 0;font-size:18px;font-weight:500;">${escapeHtml(input.serviceName)}</p>
    <p style="margin:0 0 4px 0;font-size:15px;">${dateStr} u ${timeStr}</p>
  </div>
  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 32px 0;">Una će potvrditi i javiti se u najkraćem roku. Kad potvrdi, dobićete email sa detaljima i mogućnošću dodavanja u kalendar.</p>
  <hr style="border:none;border-top:1px solid #EDE7DF;margin:24px 0;">
  <p style="font-size:11px;color:#8A8580;text-align:center;margin:0;">UP Makeup · Majora Milana Tepića 13, Gradiška</p>
</div></body></html>`;

  const text = `UP MAKEUP — Primili smo vašu rezervaciju

Hvala vam, ${input.clientName}.

${input.serviceName}
${dateStr} u ${timeStr}

Una će potvrditi i javiti se u najkraćem roku. Kad potvrdi, dobićete email sa detaljima i mogućnošću dodavanja u kalendar.

UP Makeup · Majora Milana Tepića 13, Gradiška`;

  return { subject, html, text };
}
```

- [ ] **Step 2: Modifikovati confirmation subject**

U `renderClientConfirmationEmail`, pronaći subject liniju i zamijeniti:

```ts
// Staro:
const subject = `Vaša rezervacija — ${input.serviceName}, ${dateStr} u ${timeStr}`;

// Novo:
const subject = `Una je potvrdila — ${input.serviceName}, ${dateStr} u ${timeStr}`;
```

- [ ] **Step 3: Dodati `renderBookingNotConfirmedEmail` i `renderBookingCancelledEmail`**

```ts
export function renderBookingNotConfirmedEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const dateStr = formatDateSr(input.startTime);
  const timeStr = formatInTimeZone(input.startTime, TZ, "HH:mm");

  const subject = `Termin nije potvrđen — ${input.serviceName}, ${dateStr}`;

  const html = `<!DOCTYPE html>
<html lang="sr"><head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A2A2A;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#C4787A;margin:0 0 8px 0;">UP MAKEUP</h1>
  <h2 style="font-size:24px;font-weight:400;margin:0 0 24px 0;">Termin nije potvrđen</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;">Nažalost, vaš termin za <strong>${escapeHtml(input.serviceName)}</strong> ${dateStr} u ${timeStr} nije potvrđen.</p>
  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 32px 0;">Za novi termin rezervišite na <a href="${escapeHtmlAttr(input.adminPanelUrl.replace('/admin/termini', '/zakazi'))}" style="color:#C4787A;">upmakeup.ba/zakazi</a> ili javite na <a href="tel:+38765810323" style="color:#C4787A;">+387 65 810 323</a>.</p>
  <hr style="border:none;border-top:1px solid #EDE7DF;margin:24px 0;">
  <p style="font-size:11px;color:#8A8580;text-align:center;margin:0;">UP Makeup · Majora Milana Tepića 13, Gradiška</p>
</div></body></html>`;

  const text = `UP MAKEUP — Termin nije potvrđen

Nažalost, vaš termin za ${input.serviceName} ${dateStr} u ${timeStr} nije potvrđen.

Za novi termin rezervišite na upmakeup.ba/zakazi ili javite na +387 65 810 323.

UP Makeup · Majora Milana Tepića 13, Gradiška`;

  return { subject, html, text };
}

export function renderBookingCancelledEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const dateStr = formatDateSr(input.startTime);
  const timeStr = formatInTimeZone(input.startTime, TZ, "HH:mm");

  const subject = `Termin otkazan — ${input.serviceName}, ${dateStr} u ${timeStr}`;

  const html = `<!DOCTYPE html>
<html lang="sr"><head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A2A2A;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#C4787A;margin:0 0 8px 0;">UP MAKEUP</h1>
  <h2 style="font-size:24px;font-weight:400;margin:0 0 24px 0;">Termin je otkazan</h2>
  <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;">Vaš prethodno potvrđeni termin za <strong>${escapeHtml(input.serviceName)}</strong> ${dateStr} u ${timeStr} je otkazan.</p>
  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 16px 0;">U prilogu je ažurirani .ics fajl koji briše događaj iz vašeg kalendara.</p>
  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 32px 0;">Za novi termin javite na <a href="tel:+38765810323" style="color:#C4787A;">+387 65 810 323</a>.</p>
  <hr style="border:none;border-top:1px solid #EDE7DF;margin:24px 0;">
  <p style="font-size:11px;color:#8A8580;text-align:center;margin:0;">UP Makeup · Majora Milana Tepića 13, Gradiška</p>
</div></body></html>`;

  const text = `UP MAKEUP — Termin je otkazan

Vaš prethodno potvrđeni termin za ${input.serviceName} ${dateStr} u ${timeStr} je otkazan.

U prilogu je ažurirani .ics fajl koji briše događaj iz vašeg kalendara.

Za novi termin javite na +387 65 810 323.

UP Makeup · Majora Milana Tepića 13, Gradiška`;

  return { subject, html, text };
}
```

NAPOMENA: `escapeHtmlAttr` helper postoji u templates.ts od PR #16 review fix-a. Koristi se za href atribute. Ako ne postoji, zamijeni sa `escapeHtml` (adekvatno za URL-ove bez specijalnih HTML karaktera).

- [ ] **Step 4: Dodati testove u templates.test.ts**

```ts
describe("renderBookingReceivedEmail", () => {
  it("subject sadrži uslugu i datum bez vremena", () => {
    const { subject } = renderBookingReceivedEmail(clientInput);
    expect(subject).toContain("Primili smo");
    expect(subject).toContain("Šminkanje");
  });

  it("body ne sadrži .ics referencu", () => {
    const { text } = renderBookingReceivedEmail(clientInput);
    expect(text).not.toContain(".ics");
    expect(text).toContain("Kad potvrdi");
  });
});

describe("renderBookingNotConfirmedEmail", () => {
  it("subject sadrži 'nije potvrđen'", () => {
    const { subject } = renderBookingNotConfirmedEmail(clientInput);
    expect(subject).toContain("nije potvrđen");
  });

  it("body sadrži rebook CTA", () => {
    const { text } = renderBookingNotConfirmedEmail(clientInput);
    expect(text).toContain("upmakeup.ba/zakazi");
    expect(text).toContain("+387 65 810 323");
  });
});

describe("renderBookingCancelledEmail", () => {
  it("subject sadrži 'otkazan'", () => {
    const { subject } = renderBookingCancelledEmail(clientInput);
    expect(subject).toContain("otkazan");
  });

  it("body pominje .ics za brisanje iz kalendara", () => {
    const { text } = renderBookingCancelledEmail(clientInput);
    expect(text).toContain(".ics");
    expect(text).toContain("briše događaj");
  });
});

describe("renderClientConfirmationEmail — updated subject", () => {
  it("subject počinje sa 'Una je potvrdila'", () => {
    const { subject } = renderClientConfirmationEmail(clientInput);
    expect(subject).toMatch(/^Una je potvrdila/);
  });
});
```

Provjeri da `clientInput` fixture ima `endTime` (od Task 2 fix-a).

- [ ] **Step 5: Run testovi, typecheck**

```bash
npm test -- tests/unit/notifications/templates.test.ts && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/templates.ts tests/unit/notifications/templates.test.ts && git commit -m "feat(notifications): booking received + not confirmed + cancelled templates"
```

---

## Task 3: Orchestratori — booking received + cancellation

**Files:**
- Create: `src/lib/notifications/send-booking-received-email.ts`
- Create: `src/lib/notifications/send-cancellation-email.ts`
- Create: `tests/unit/notifications/send-booking-received-email.test.ts`
- Create: `tests/unit/notifications/send-cancellation-email.test.ts`

- [ ] **Step 1: Kreirati `send-booking-received-email.ts`**

Identičan pattern kao `send-client-email.ts` ali BEZ .ics attachment:

```ts
import { getResendClient } from "./resend";
import {
  renderBookingReceivedEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { sanitizeError } from "@/lib/utils/log";

export async function sendBookingReceivedEmail(
  input: NewAppointmentEmailInput,
): Promise<void> {
  if (!input.clientEmail) return;

  const resend = getResendClient();
  if (!resend) {
    console.warn("[booking-received email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[booking-received email skipped] RESEND_FROM_EMAIL missing");
    return;
  }

  try {
    const { subject, html, text } = renderBookingReceivedEmail(input);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.clientEmail],
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error("Resend booking-received error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error("sendBookingReceivedEmail error:", sanitizeError(e));
  }
}
```

- [ ] **Step 2: Kreirati `send-cancellation-email.ts`**

```ts
import { getResendClient } from "./resend";
import {
  renderBookingNotConfirmedEmail,
  renderBookingCancelledEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { buildIcsContent } from "./ics";
import { sanitizeError } from "@/lib/utils/log";

export type CancellationEmailInput = NewAppointmentEmailInput & {
  previousStatus: "ceka" | "potvrdjen";
};

export async function sendCancellationEmail(
  input: CancellationEmailInput,
): Promise<void> {
  if (!input.clientEmail) return;

  const resend = getResendClient();
  if (!resend) {
    console.warn("[cancellation email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[cancellation email skipped] RESEND_FROM_EMAIL missing");
    return;
  }

  try {
    const wasPreviouslyConfirmed = input.previousStatus === "potvrdjen";

    const { subject, html, text } = wasPreviouslyConfirmed
      ? renderBookingCancelledEmail(input)
      : renderBookingNotConfirmedEmail(input);

    const attachments: Array<{ filename: string; content: string }> = [];

    if (wasPreviouslyConfirmed) {
      const icsContent = buildIcsContent({
        uid: `appt-${input.startTime.getTime()}@upmakeup.ba`,
        start: input.startTime,
        end: input.endTime,
        summary: `${input.serviceName} — UP Makeup`,
        location: "Majora Milana Tepića 13, Gradiška",
        description: `OTKAZANO: ${input.serviceName}`,
        method: "CANCEL",
        status: "CANCELLED",
      });
      attachments.push({
        filename: "otkazano.ics",
        content: Buffer.from(icsContent, "utf-8").toString("base64"),
      });
    }

    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.clientEmail],
      subject,
      html,
      text,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    if (result.error) {
      console.error("Resend cancellation error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error("sendCancellationEmail error:", sanitizeError(e));
  }
}
```

- [ ] **Step 3: Testovi za oba orchestratora**

`send-booking-received-email.test.ts` (3 testa — isti pattern kao existing):
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendBookingReceivedEmail } from "@/lib/notifications/send-booking-received-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const baseInput = {
  clientName: "Test", clientPhone: "+387 65 000 000",
  clientEmail: "test@example.com", serviceName: "Šminkanje",
  startTime: new Date("2026-05-28T16:00:00.000Z"),
  endTime: new Date("2026-05-28T17:00:00.000Z"),
  notes: null, adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
};

describe("sendBookingReceivedEmail", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { _resetResendClientForTests(); warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; });

  it("skip silently if no client email", async () => {
    await sendBookingReceivedEmail({ ...baseInput, clientEmail: null });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it("warns if RESEND_API_KEY missing", async () => {
    await sendBookingReceivedEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith("[booking-received email skipped] RESEND_API_KEY missing");
  });
  it("warns if RESEND_FROM_EMAIL missing", async () => {
    process.env.RESEND_API_KEY = "re_test";
    await sendBookingReceivedEmail(baseInput);
    expect(warnSpy).toHaveBeenCalledWith("[booking-received email skipped] RESEND_FROM_EMAIL missing");
  });
});
```

`send-cancellation-email.test.ts` (3 testa):
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendCancellationEmail } from "@/lib/notifications/send-cancellation-email";
import { _resetResendClientForTests } from "@/lib/notifications/resend";

const baseInput = {
  clientName: "Test", clientPhone: "+387 65 000 000",
  clientEmail: "test@example.com", serviceName: "Šminkanje",
  startTime: new Date("2026-05-28T16:00:00.000Z"),
  endTime: new Date("2026-05-28T17:00:00.000Z"),
  notes: null, adminPanelUrl: "https://www.upmakeup.ba/admin/termini",
};

describe("sendCancellationEmail", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { _resetResendClientForTests(); warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); delete process.env.RESEND_API_KEY; delete process.env.RESEND_FROM_EMAIL; });

  it("skip silently if no client email", async () => {
    await sendCancellationEmail({ ...baseInput, clientEmail: null, previousStatus: "ceka" });
    expect(warnSpy).not.toHaveBeenCalled();
  });
  it("warns if RESEND_API_KEY missing (ceka scenario)", async () => {
    await sendCancellationEmail({ ...baseInput, previousStatus: "ceka" });
    expect(warnSpy).toHaveBeenCalledWith("[cancellation email skipped] RESEND_API_KEY missing");
  });
  it("warns if RESEND_API_KEY missing (potvrdjen scenario)", async () => {
    await sendCancellationEmail({ ...baseInput, previousStatus: "potvrdjen" });
    expect(warnSpy).toHaveBeenCalledWith("[cancellation email skipped] RESEND_API_KEY missing");
  });
});
```

- [ ] **Step 4: Run tests + typecheck**

```bash
npm test -- tests/unit/notifications/ && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/send-booking-received-email.ts src/lib/notifications/send-cancellation-email.ts tests/unit/notifications/send-booking-received-email.test.ts tests/unit/notifications/send-cancellation-email.test.ts && git commit -m "feat(notifications): booking received + cancellation email orchestrators"
```

---

## Task 4: Rewire server action triggeri

**Files:**
- Modify: `src/app/zakazi/actions.ts` (zamijeni client confirmation sa booking received)
- Modify: `src/app/admin/(protected)/termini/actions.ts` (dodaj triggere na 3 action-a)

- [ ] **Step 1: Rewire zakazi/actions.ts**

Zamijeniti import:

```ts
// Staro:
import { sendClientConfirmationEmail } from "@/lib/notifications/send-client-email";
// Novo:
import { sendBookingReceivedEmail } from "@/lib/notifications/send-booking-received-email";
```

Zamijeniti trigger poziv (oko linije `after(() => sendClientConfirmationEmail({...}))`) sa:

```ts
after(() =>
  sendBookingReceivedEmail({
    clientName: parsed.data.client_name,
    clientPhone: normalizedPhone,
    clientEmail: parsed.data.client_email ?? null,
    serviceName: service.name,
    startTime: appointmentDate,
    endTime: end,
    notes: parsed.data.notes ?? null,
    adminPanelUrl,
  }),
);
```

Isti payload — samo orchestrator se mijenja.

- [ ] **Step 2: Dodati triggere u termini/actions.ts**

Na vrhu fajla dodati importe:

```ts
import { after } from "next/server";
import { sendClientConfirmationEmail } from "@/lib/notifications/send-client-email";
import { sendCancellationEmail } from "@/lib/notifications/send-cancellation-email";
import { normalizeSiteUrl } from "@/lib/utils/site-url";
```

**2a. confirmAppointment** — NAKON uspješnog update-a (linija ~34, ispod `revalidatePath` poziva), PRIJE `return { ok: true }`, dodati:

```ts
    // Dohvati appointment + service za email payload
    const { data: appt } = await sb
      .from("appointments")
      .select("client_name, client_phone, client_email, start_time, end_time, notes, services(name)")
      .eq("id", id)
      .single();

    if (appt?.client_email) {
      const adminPanelUrl = `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`;
      after(() =>
        sendClientConfirmationEmail({
          clientName: appt.client_name,
          clientPhone: appt.client_phone,
          clientEmail: appt.client_email,
          serviceName: appt.services?.name ?? "",
          startTime: new Date(appt.start_time),
          endTime: new Date(appt.end_time),
          notes: appt.notes,
          adminPanelUrl,
        }),
      );
    }
```

Ukloniti TODO komentar `// TODO(Phase 8): sendConfirmationEmail(id)`.

**2b. cancelAppointment** — PRIJE update-a (linija ~46), dodati query za prethodni status:

```ts
    // Dohvati appointment + service PRIJE update-a za cancel email
    const { data: appt } = await sb
      .from("appointments")
      .select("client_name, client_phone, client_email, start_time, end_time, notes, status, services(name)")
      .eq("id", id)
      .single();
```

NAKON update-a (ispod `revalidatePath` poziva), dodati:

```ts
    if (appt?.client_email && (appt.status === "ceka" || appt.status === "potvrdjen")) {
      const adminPanelUrl = `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`;
      after(() =>
        sendCancellationEmail({
          clientName: appt.client_name,
          clientPhone: appt.client_phone,
          clientEmail: appt.client_email,
          serviceName: appt.services?.name ?? "",
          startTime: new Date(appt.start_time),
          endTime: new Date(appt.end_time),
          notes: appt.notes,
          adminPanelUrl,
          previousStatus: appt.status as "ceka" | "potvrdjen",
        }),
      );
    }
```

**2c. createManualAppointment** — NAKON uspješnog insert-a, dodati query za service name (samo ime za email) i trigger. Service name nije u `service` variable (koja selektuje samo `id, duration_min`). Proširiti existing select:

```ts
// Staro (linija ~133):
.select("id,duration_min")
// Novo:
.select("id,duration_min,name")
```

Onda NAKON insert-a (prije `return { ok: true }`):

```ts
    if (parsed.data.client_email) {
      const adminPanelUrl = `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`;
      after(() =>
        sendClientConfirmationEmail({
          clientName: parsed.data.client_name,
          clientPhone: normalizePhone(parsed.data.client_phone),
          clientEmail: parsed.data.client_email || null,
          serviceName: service.name,
          startTime: start,
          endTime: end,
          notes: parsed.data.notes || null,
          adminPanelUrl,
        }),
      );
    }
```

- [ ] **Step 3: Pokrenuti pun test suite**

```bash
npm test
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/app/zakazi/actions.ts src/app/admin/\(protected\)/termini/actions.ts && git commit -m "feat(notifications): two-stage email triggers — received on book, confirmed/cancelled on admin action"
```

---

## Task 5: Verify + Push

- [ ] **Step 1: Full test suite**

```bash
npm test
```

- [ ] **Step 2: Production build**

```bash
npm run build
```

- [ ] **Step 3: Push**

```bash
git push origin feat/client-email-and-ics
```

PR #60 automatski se ažurira sa novim commit-ima.

- [ ] **Step 4: Verify PR status**

```bash
gh pr view 60 --json url,mergeable,mergeStateStatus --jq '"\(.url) [\(.mergeable) | \(.mergeStateStatus)]"'
```

---

## Self-Review

**Spec coverage:**
- Trigger 1 (online booking → primljeno): ✓ Task 4 Step 1 (zakazi rewire)
- Trigger 2 (admin Potvrdi → potvrđeno + .ics): ✓ Task 4 Step 2a
- Trigger 3 (admin Otkaži → not confirmed/cancelled): ✓ Task 4 Step 2b
- Trigger 4 (manual booking → potvrđeno + .ics): ✓ Task 4 Step 2c
- ICS METHOD:CANCEL: ✓ Task 1
- 3 nova template: ✓ Task 2
- Confirmation subject update: ✓ Task 2 Step 2
- Previous status kontekst: ✓ Task 3 (CancellationEmailInput type) + Task 4 Step 2b

**Placeholder scan:** Nema TBD, TODO, "implement later", "similar to". Sav kod eksplicitan.

**Type consistency:** `CancellationEmailInput` extends `NewAppointmentEmailInput` sa `previousStatus`. Koristi se u send-cancellation-email.ts (Task 3) i proslijeđuje se iz cancelAppointment (Task 4). `IcsInput.method` i `.status` uvedeni u Task 1, korišteni u Task 3 (cancellation .ics).
