# Email Tracking + Admin Badge + Booking Form Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB-backed tracking koji email-ovi su poslani po appointment-u, admin badge u Termini + Dashboard koji pokazuje email status, i hint u booking formi koji objašnjava šta se desi ako klijent ostavi email.

**Architecture:** 3 nove nullable `timestamptz` kolone na `appointments` tabeli. Orchestratori pišu nazad u DB nakon uspješnog Resend send-a (best-effort, ne blokira). Admin UI čita kolone i prikazuje inline badge. Booking forma dobija statički helper text ispod email polja.

**Tech Stack:** TypeScript strict, Supabase (PostgreSQL), Next.js 16, Vitest, Tailwind CSS v4.

---

## File Structure

**Create:**
- `supabase/migrations/20260526200000_email_tracking_columns.sql`

**Modify:**
- `src/types/database.ts` — regen sa novim kolonama
- `src/lib/notifications/templates.ts` — dodati `appointmentId` na `NewAppointmentEmailInput`
- `src/lib/notifications/send-booking-received-email.ts` — DB write-back
- `src/lib/notifications/send-client-email.ts` — DB write-back
- `src/lib/notifications/send-cancellation-email.ts` — DB write-back
- `src/app/zakazi/actions.ts` — proslijediti `appointmentId`
- `src/app/admin/(protected)/termini/actions.ts` — proslijediti `appointmentId` (confirmAppointment, cancelAppointment, createManualAppointment)
- `src/components/admin/AppointmentRow.tsx` — email badge
- `src/app/admin/(protected)/dashboard/page.tsx` — expand query + inline badge
- `src/app/admin/(protected)/termini/page.tsx` — expand query
- `src/components/booking/StepDetails.tsx` — email hint
- `src/app/admin/(protected)/postavke/email-actions.ts` — dodati `appointmentId` na test fixture (testEmail nema real appointment, koristiti 0)

---

## Task 1: DB migracija + types regen

**Files:**
- Create: `supabase/migrations/20260526200000_email_tracking_columns.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Kreirati migraciju**

```sql
-- Email tracking: kad je koji email tip poslan klijentu.
-- NULL = nije poslan (klijent bez email-a ili email orchestrator nije
-- uspješno deliverirao). Timestamp se piše NAKON uspješnog Resend API
-- call-a (best-effort, ne blokira booking flow).

ALTER TABLE public.appointments
  ADD COLUMN email_received_sent_at timestamptz NULL,
  ADD COLUMN email_confirmed_sent_at timestamptz NULL,
  ADD COLUMN email_cancelled_sent_at timestamptz NULL;

COMMENT ON COLUMN public.appointments.email_received_sent_at IS
  'Kad je "Primili smo rezervaciju" email poslan klijentu. NULL = nije poslan.';
COMMENT ON COLUMN public.appointments.email_confirmed_sent_at IS
  'Kad je "Una je potvrdila" email poslan klijentu. NULL = nije poslan.';
COMMENT ON COLUMN public.appointments.email_cancelled_sent_at IS
  'Kad je cancellation email poslan klijentu. NULL = nije poslan.';
```

- [ ] **Step 2: Aplicirati na lokalni Docker Supabase**

```bash
docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db | head -1) psql -U postgres -d postgres < supabase/migrations/20260526200000_email_tracking_columns.sql
```

- [ ] **Step 3: Regenerisati types**

```bash
supabase gen types typescript --local 2>/dev/null | grep -v "^Connecting\|^A new version" > src/types/database.ts
```

Verifikovati:

```bash
grep "email_received_sent_at\|email_confirmed_sent_at\|email_cancelled_sent_at" src/types/database.ts | head -6
```

Expected: 6 pojavljivanja (Row + Insert + Update za svaku kolonu).

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260526200000_email_tracking_columns.sql src/types/database.ts && git commit -m "feat(db): add email tracking columns to appointments"
```

---

## Task 2: Extend input type + orchestrator DB write-back

**Files:**
- Modify: `src/lib/notifications/templates.ts` (type)
- Modify: `src/lib/notifications/send-booking-received-email.ts`
- Modify: `src/lib/notifications/send-client-email.ts`
- Modify: `src/lib/notifications/send-cancellation-email.ts`
- Modify: `src/app/admin/(protected)/postavke/email-actions.ts` (test fixture)

- [ ] **Step 1: Dodati `appointmentId` na `NewAppointmentEmailInput`**

U `src/lib/notifications/templates.ts`, pronaći `NewAppointmentEmailInput` type i dodati:

```ts
/** ID appointment-a u DB. Koristi se za write-back email tracking kolona. */
appointmentId: number;
```

- [ ] **Step 2: Update `send-booking-received-email.ts` — DB write-back**

Dodati import na vrhu:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
```

NAKON uspješnog `resend.emails.send()` (unutar try bloka, nakon `if (result.error)` check-a), dodati:

```ts
    if (!result.error) {
      const sb = createAdminClient();
      void sb
        .from("appointments")
        .update({ email_received_sent_at: new Date().toISOString() })
        .eq("id", input.appointmentId);
    }
```

`void` = best-effort, ne čekamo rezultat i ne fail-ujemo ako DB write propadne.

- [ ] **Step 3: Update `send-client-email.ts` — DB write-back**

Isti pattern. Dodati import za `createAdminClient`. NAKON uspješnog send-a:

```ts
    if (!result.error) {
      const sb = createAdminClient();
      void sb
        .from("appointments")
        .update({ email_confirmed_sent_at: new Date().toISOString() })
        .eq("id", input.appointmentId);
    }
```

- [ ] **Step 4: Update `send-cancellation-email.ts` — DB write-back**

Isti pattern:

```ts
    if (!result.error) {
      const sb = createAdminClient();
      void sb
        .from("appointments")
        .update({ email_cancelled_sent_at: new Date().toISOString() })
        .eq("id", input.appointmentId);
    }
```

- [ ] **Step 5: Fix test email fixture u `email-actions.ts`**

`sendTestAdminEmail` u `email-actions.ts` kreira dummy input za test email. Dodaj `appointmentId: 0` (test email nema real appointment):

Pronaći input objekat u `sendTestAdminEmail` (oko linije sa `clientName: "Test Klijent"`) i dodati `appointmentId: 0`.

- [ ] **Step 6: Fix svi testovi koji kreiraju `NewAppointmentEmailInput` fixture**

```bash
grep -rn "clientName.*Test\|baseInput.*=\|clientInput.*=" tests/unit/notifications/ | head -10
```

Za svaki fixture dodaj `appointmentId: 42` (ili bilo koji broj — testovi ne diraju DB).

- [ ] **Step 7: Typecheck + testovi**

```bash
npm run typecheck && npm test -- tests/unit/notifications/
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(notifications): email tracking write-back after successful send"
```

---

## Task 3: Update trigger sites sa appointmentId

**Files:**
- Modify: `src/app/zakazi/actions.ts`
- Modify: `src/app/admin/(protected)/termini/actions.ts`

- [ ] **Step 1: `zakazi/actions.ts` — proslijediti appointment ID**

U `createAppointment` action, nakon insert-a, appointment ID je u `inserted.id` (ili sličan var). Pronaći oba email trigger poziva (`sendNewAppointmentEmail` + `sendBookingReceivedEmail`) i dodati `appointmentId: inserted.id` u svaki payload.

VAŽNO: pronaći tačno ime varijable sa `grep -n "inserted\|\.id\|appointment.*id" src/app/zakazi/actions.ts` prije editovanja.

- [ ] **Step 2: `termini/actions.ts` — proslijediti ID za confirm/cancel/manual**

Za `confirmAppointment` i `cancelAppointment`: ID je već argument funkcije (`id: number`). Dodati `appointmentId: id` u email payload.

Za `createManualAppointment`: ID je u `inserted.id` nakon insert-a. Dodati `appointmentId: inserted.id` u email payload.

- [ ] **Step 3: Typecheck + full test suite**

```bash
npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/app/zakazi/actions.ts src/app/admin/\(protected\)/termini/actions.ts && git commit -m "feat(notifications): pass appointmentId to all email triggers for tracking"
```

---

## Task 4: Admin UI badges (AppointmentRow + Dashboard)

**Files:**
- Modify: `src/components/admin/AppointmentRow.tsx`
- Modify: `src/app/admin/(protected)/dashboard/page.tsx`
- Modify: `src/app/admin/(protected)/termini/page.tsx`

- [ ] **Step 1: Expand AppointmentRow type sa email tracking fields**

U `src/components/admin/AppointmentRow.tsx`, pronaći `type Appointment` i dodati:

```ts
  email_received_sent_at: string | null;
  email_confirmed_sent_at: string | null;
  email_cancelled_sent_at: string | null;
```

- [ ] **Step 2: Dodati email badge JSX u AppointmentRow**

Ispod `client_email` (ili pored `client_phone` linka), dodati badge:

```tsx
{appointment.client_email && (
  <span className="inline-flex items-center gap-1 text-[10px] text-light">
    <span>📧</span>
    {appointment.email_received_sent_at && <span className="text-green-600">Primljeno ✓</span>}
    {appointment.email_confirmed_sent_at && <span className="text-green-600">· Potvrda ✓</span>}
    {appointment.email_cancelled_sent_at && <span className="text-red-500">· Otkazano ✓</span>}
    {appointment.client_email && !appointment.email_received_sent_at && !appointment.email_confirmed_sent_at && (
      <span className="text-amber-600">Email postoji, slanje u toku…</span>
    )}
  </span>
)}
```

- [ ] **Step 3: Expand Termini page query**

U `src/app/admin/(protected)/termini/page.tsx`, pronaći appointments select:

```ts
.select("id,client_name,client_phone,client_email,start_time,end_time,status,notes,services(name)")
```

Dodati 3 kolone:

```ts
.select("id,client_name,client_phone,client_email,start_time,end_time,status,notes,email_received_sent_at,email_confirmed_sent_at,email_cancelled_sent_at,services(name)")
```

Provjeriti da AppointmentRow renderovanje prosljeđuje nove field-ove.

- [ ] **Step 4: Expand Dashboard query i dodati badge inline**

U `src/app/admin/(protected)/dashboard/page.tsx`, pronaći dayList select:

```ts
.select("id,client_name,client_phone,start_time,status,services(name)")
```

Dodati `client_email` + 3 tracking kolone:

```ts
.select("id,client_name,client_phone,client_email,start_time,status,email_received_sent_at,email_confirmed_sent_at,email_cancelled_sent_at,services(name)")
```

U inline rendering (oko `dayList.map((appt, i) => {`), dodati badge:

```tsx
{appt.client_email && (
  <span className="text-[9px] text-light">
    📧
    {appt.email_received_sent_at && <span className="text-green-600"> ✓</span>}
    {appt.email_confirmed_sent_at && <span className="text-green-600"> ✓✓</span>}
  </span>
)}
```

Dashboard badge je kompaktniji (samo ikone) jer prostor je manji.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AppointmentRow.tsx src/app/admin/\(protected\)/dashboard/page.tsx src/app/admin/\(protected\)/termini/page.tsx && git commit -m "feat(admin): email tracking badges u Termini + Dashboard"
```

---

## Task 5: Booking form email hint

**Files:**
- Modify: `src/components/booking/StepDetails.tsx`

- [ ] **Step 1: Pronaći email input field**

```bash
grep -n "client_email\|Email.*opciono" src/components/booking/StepDetails.tsx
```

Expected: label "Email (opciono)" oko linije 125-137.

- [ ] **Step 2: Dodati helper text ispod email input-a**

Pronaći `</input>` ili self-closing `/>` za email input, i ispod njega (ali PRIJE error div-a `{fieldErrors.client_email && ...}`) dodati:

```tsx
<p className="mt-1 text-[11px] text-light">
  Ostavite email za automatsku potvrdu termina i mogućnost dodavanja u kalendar.
</p>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add src/components/booking/StepDetails.tsx && git commit -m "feat(booking): email hint u booking formi"
```

---

## Task 6: Verify + Push + PR

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
git push -u origin feat/email-tracking-and-hints
```

- [ ] **Step 4: Create PR**

```bash
gh pr create --base main --head feat/email-tracking-and-hints --title "feat: email tracking badges + booking form hint" --body "$(cat <<'EOF'
## Summary

- DB-backed tracking koji email-ovi su poslani po appointment-u (3 timestamptz kolone)
- Admin badge u Termini + Dashboard koji pokazuje email status (📧 Primljeno ✓ · Potvrda ✓)
- Hint u booking formi: 'Ostavite email za automatsku potvrdu i mogućnost dodavanja u kalendar'

## Test plan

- [x] npm test — svi testovi prolaze
- [x] npm run build — clean
- [ ] Manual smoke:
  1. Nova rezervacija sa email-om → Termini tab prikazuje 📧 Primljeno ✓
  2. Una potvrdi → badge ažuriran na 📧 Primljeno ✓ · Potvrda ✓
  3. Rezervacija bez email-a → nema badge (Una zna da treba WhatsApp)
  4. /zakazi forma → ispod email polja piše hint o automatskoj potvrdi
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- DB migracija: ✓ Task 1
- Orchestrator write-back: ✓ Task 2 (3 orchestratora)
- Trigger appointmentId: ✓ Task 3 (4 trigger site-a)
- Admin badge (Termini): ✓ Task 4 Steps 1-3
- Admin badge (Dashboard): ✓ Task 4 Steps 4
- Booking form hint: ✓ Task 5
- Test email fixture fix: ✓ Task 2 Step 5

**Placeholder scan:** Nema TBD/TODO. Sav kod eksplicitan.

**Type consistency:** `appointmentId: number` dodat na `NewAppointmentEmailInput` u Task 2 Step 1, korišten u Task 2 Steps 2-4 (write-back), Task 3 Steps 1-2 (trigger payload), Task 2 Step 5 (test fixture `appointmentId: 0`).
