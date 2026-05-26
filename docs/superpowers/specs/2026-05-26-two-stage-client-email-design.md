# Two-Stage Client Email + Cancellation Notification Design

## Problem

PR #60 šalje klijentu confirmation email sa `.ics` (STATUS:CONFIRMED) **odmah pri rezervaciji** — dok je appointment još u `status="ceka"` i Una ga nije potvrdila. Prozor od par sati do par dana gdje klijent ima "potvrđeni" kalendar event koji zapravo nije potvrđen. Plus manual booking flow (Una kreira termin telefonski) ne šalje email at all.

## Odluka

Dvostepeni email flow: **odmah** klijent dobija "primljeno" (bez .ics), **.ics stigne tek kad Una potvrdi**. Plus cancellation email kad Una otkaže.

## Konačni 4-trigger email flow

```
1. ONLINE BOOKING (/zakazi → createAppointment, status=ceka):
   → Admin email: "Nova rezervacija" + .ics           [odmah, NEIZMIJENJENO]
   → Client email: "Primili smo rezervaciju"           [odmah, BEZ .ics]

2. ADMIN POTVRDI (Potvrdi dugme → confirmAppointment, status→potvrdjen):
   → Client email: "Una je potvrdila" + .ics           [tek sad ima calendar event]

3. ADMIN OTKAŽI (Otkaži dugme → cancelAppointment, status→otkazan):
   → Client email: varijanta zavisno od prethodnog statusa (vidi dolje)

4. MANUAL BOOKING (ManualAppointmentForm → createManualAppointment, status=potvrdjen):
   → Client email: "Una je potvrdila" + .ics           [ako client_email postoji]
```

## Cancellation — dva scenarija

| Prethodni status | Klijent ima calendar event? | Subject | .ics? |
|---|---|---|---|
| `ceka` → `otkazan` | Ne | "Termin nije potvrđen — {usluga}, {datum}" | Ne |
| `potvrdjen` → `otkazan` | Da | "Termin otkazan — {usluga}, {datum} u {vrijeme}" | Da — `STATUS:CANCELLED`, `METHOD:CANCEL`, isti UID |

`cancelAppointment` action čita trenutni status iz DB-a PRIJE update-a i prosljeđuje kao kontekst email orchestrator-u.

## Email sadržaj po tipu

### 1. Booking Received (odmah, online booking)

- **Subject**: `Primili smo vašu rezervaciju — {serviceName}, {datum}`
- **Body**: "Hvala {clientName}. Una će potvrditi i javiti se u najkraćem roku. Kad potvrdi, dobićete email sa detaljima i mogućnošću dodavanja u kalendar."
- **Attachment**: nema
- **Ton**: friendly acknowledgment, expectation setting

### 2. Booking Confirmed (na admin Potvrdi ili manual booking)

- **Subject**: `Una je potvrdila — {serviceName}, {datum} u {vrijeme}`
- **Body**: "Vaš termin je potvrđen! Detalji: usluga, datum, vrijeme, adresa. U prilogu je .ics za kalendar."
- **Attachment**: `.ics` sa `STATUS:CONFIRMED`, `METHOD:REQUEST`
- **Ton**: excitement, professional confirmation

### 3a. Booking Not Confirmed (ceka → otkazan)

- **Subject**: `Termin nije potvrđen — {serviceName}, {datum}`
- **Body**: "Nažalost, vaš termin za {uslugu} {datum} u {vrijeme} nije potvrđen. Za novi termin rezervišite na {siteUrl}/zakazi ili javite na +387 65 810 323."
- **Attachment**: nema
- **Ton**: apologetic, rebook CTA

### 3b. Booking Cancelled (potvrdjen → otkazan)

- **Subject**: `Termin otkazan — {serviceName}, {datum} u {vrijeme}`
- **Body**: "Vaš prethodno potvrđeni termin je otkazan. U prilogu je ažurirani .ics koji briše događaj iz vašeg kalendara. Za novi termin javite na +387 65 810 323."
- **Attachment**: `.ics` sa `STATUS:CANCELLED`, `METHOD:CANCEL`, isti UID kao originalni confirmation
- **Ton**: apologetic, direct

## File structure

### Novi fajlovi

- `src/lib/notifications/send-booking-received-email.ts` — lightweight orchestrator, bez .ics
- `src/lib/notifications/send-cancellation-email.ts` — orchestrator sa prethodni-status kontekstom

### Modificirani fajlovi

- `src/lib/notifications/templates.ts`:
  - Dodati `renderBookingReceivedEmail(input)` — kratki acknowledgment
  - Modifikovati `renderClientConfirmationEmail(input)` — subject sa "Vaša rezervacija —" na "Una je potvrdila —", body ton ostaje sličan ali sa jačim "potvrđeno" signalom
  - Dodati `renderBookingNotConfirmedEmail(input)` — ceka→otkazan
  - Dodati `renderBookingCancelledEmail(input)` — potvrdjen→otkazan

- `src/lib/notifications/ics.ts`:
  - `IcsInput` dobija opciono `method?: "REQUEST" | "CANCEL"` (default "REQUEST")
  - `IcsInput` dobija opciono `status?: "CONFIRMED" | "CANCELLED"` (default "CONFIRMED")
  - `buildIcsContent` emituje `METHOD:` i `STATUS:` iz input-a

- `src/app/zakazi/actions.ts`:
  - Zamijeniti `sendClientConfirmationEmail` trigger sa `sendBookingReceivedEmail`
  - Admin email trigger ostaje neizmijenjen

- `src/app/admin/(protected)/termini/actions.ts`:
  - `confirmAppointment`: dodati `sendClientConfirmationEmail` trigger (sa .ics)
  - `cancelAppointment`: dodati `sendCancellationEmail` trigger (sa prethodni status kontekstom)
  - `createManualAppointment`: dodati `sendClientConfirmationEmail` trigger (ako client_email)

### Testovi

- `tests/unit/notifications/ics.test.ts` — dodati testove za METHOD:CANCEL + STATUS:CANCELLED
- `tests/unit/notifications/templates.test.ts` — testovi za 3 nova template render-a
- `tests/unit/notifications/send-booking-received-email.test.ts` — novo (3 testa: skip null email, skip missing API key, skip missing FROM)
- `tests/unit/notifications/send-cancellation-email.test.ts` — novo (4 testa: skip null email, ceka→otkazan bez .ics, potvrdjen→otkazan sa .ics, skip missing env)

## Shared input types

`NewAppointmentEmailInput` (od PR #60) koristi se za sva 4 email tipa — sadrži:
`clientName`, `clientPhone`, `clientEmail`, `serviceName`, `startTime`, `endTime`, `notes`, `adminPanelUrl`

Za cancellation email, orchestrator prima dodatni `previousStatus: "ceka" | "potvrdjen"` parametar koji server action prosljeđuje na osnovu DB query-ja.

## ICS changes

```ts
// Existing (PR #60)
buildIcsContent({ ..., method: undefined, status: undefined })
// → METHOD:REQUEST + STATUS:CONFIRMED (defaults)

// Cancel case
buildIcsContent({ ..., method: "CANCEL", status: "CANCELLED" })
// → METHOD:CANCEL + STATUS:CANCELLED
```

UID mora biti isti kao u confirmation email-u (`appt-${startTime.getTime()}@upmakeup.ba`) — calendar aplikacije matchuju po UID-u da bi obrisale/ažurirale event.

## Edge cases

- **Klijent bez email-a**: svi klijentski email-i se silently skipuju (`clientEmail === null` guard)
- **Una klikne "Završen" bez "Potvrdi"**: klijent nikad ne dobije .ics — termin se obavio, retrospektivno OK. Future improvement: trigger na zavrsen ako klijent nikad nije dobio confirmation.
- **Manual booking bez email-a**: admin kreira telefonski, klijent bez email-a — silent skip
- **Una otkaže odmah nakon potvrde**: klijent dobija 2 email-a (confirmed + cancelled). .ics CANCELLED briše event iz kalendara. Korektan flow — klijent vidi potvrdu pa otkazivanje, hronološki tačno.
- **Isti klijent, dva termina istog dana**: UID-ovi su različiti (bazirani na startTime koji je fiksan 30-min grid) — bez kolizije

## Out of scope

- Email kad Una klikne "Završen" (markCompleted) — nema UX potrebe
- Klijent reply-to za otkazivanje — za sad telefon
- Email history/log u admin UI
- Reminder email 24h prije termina — treba cron job, zaseban scope
- Multi-language (BS/EN) email — za turiste, buduće
