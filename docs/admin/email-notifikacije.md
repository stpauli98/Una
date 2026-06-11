# Email notifikacije (Resend)

**Fajlovi:** `src/lib/notifications/` — `resend.ts`, `templates.ts`, `ics.ts`, `send-admin-email.ts`, `send-booking-received-email.ts`, `send-client-email.ts`, `send-cancellation-email.ts`

Transakcioni email-ovi preko [Resend](https://resend.com) API-ja. **Implementirano i uvezano u booking/admin flow** — aktivira se setovanjem `RESEND_API_KEY`; bez ključa se slanje tiho preskače i aplikacija radi normalno (WhatsApp ostaje primarni kanal komunikacije).

## Četiri email-a

| # | Funkcija | Kome | Kada | Attachment |
|---|----------|------|------|------------|
| 1 | `sendNewAppointmentEmail` | **Uni** (`ADMIN_NOTIFICATION_EMAIL`) | Klijent kreira rezervaciju | — |
| 2 | `sendBookingReceivedEmail` | Klijentu | Klijent kreira rezervaciju ("primili smo zahtjev") | — |
| 3 | `sendClientConfirmationEmail` | Klijentu | Una klikne "Potvrdi" | `rezervacija.ics` |
| 4 | `sendCancellationEmail` | Klijentu | Una otkaže (samo iz `ceka`/`potvrdjen`) | — |

**Two-stage pattern za klijenta:** "primljeno" email odmah (bez kalendara — termin još nije siguran), potvrda sa `.ics` kalendarskim event-om tek kad Una potvrdi.

## Uslovi slanja

- Email-ovi klijentu (#2–4) šalju se **samo ako je klijent unio email** — `client_email` polje u booking formi je opciono.
- Admin email (#1) ide uvijek (kad je Resend konfigurisan).
- `resend.ts` vraća `null` ako `RESEND_API_KEY` nije setovan → svi send-ovi su no-op. Lokalni dev radi bez Resend naloga.

## `after()` — ne blokira korisnika

Sva slanja idu kroz Next 16 `after()` callback:

```typescript
// src/app/zakazi/actions.ts
after(() => sendNewAppointmentEmail({ ... }));
after(() => sendBookingReceivedEmail({ ... }));
```

`after()` garantuje izvršenje **nakon što je response poslan** — booking redirect je trenutan, email ide u pozadini. Običan `void promise` bi na Vercel serverless-u mogao biti prekinut prije nego Resend fetch završi.

## Deep-link u admin email-u

Admin email sadrži dugme ka:

```
{NEXT_PUBLIC_SITE_URL}/admin/termini?date=YYYY-MM-DD&focus={id}
```

`FocusAppointment` komponenta skroluje na termin, highlight-uje ga i fokusira "Potvrdi" dugme — vidi [termini.md](./termini.md).

## `.ics` kalendarski attachment

`src/lib/notifications/ics.ts` → `buildIcsContent()`:

- Event sa stvarnim trajanjem usluge (60/120/180 min — `end_time` iz baze)
- Naziv usluge, lokacija studija, napomena
- Klijent otvori attachment → termin uskače u Google/Apple Calendar

## Email tracking kolone

Nakon uspješnog slanja upisuje se timestamp u `appointments`:

| Email | Kolona |
|-------|--------|
| #2 primljeno | `email_received_sent_at` |
| #3 potvrda | `email_confirmed_sent_at` |
| #4 otkazivanje | `email_cancelled_sent_at` |

Admin UI prikazuje status u redu termina (zelena kvačica / siva crtica). Migracija: `20260526200000_email_tracking_columns.sql`.

## Admin UI — status i test

`/admin/postavke` → sekcija **"Email obavještenja"** (`EmailNotificationStatus`):

- Prikaz da li je Resend konfigurisan + maskirana admin adresa
- "Pošalji test email" → `sendTestAdminEmail()` server action

Detalji: [postavke.md](./postavke.md)

## Environment varijable

```bash
RESEND_API_KEY=re_...                          # bez ovoga = email isključen
RESEND_FROM_EMAIL=rezervacije@upmakeup.ba      # verifikovan domen u Resend-u
ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com
```

**Preduslov za produkciju:** domen `upmakeup.ba` verifikovan u Resend dashboardu (SPF + DKIM DNS records — kroz Vercel DNS).

## HTML šabloni

`src/lib/notifications/templates.ts` — brand boje (rose/cream), srpski tekstovi, mobile-friendly tabele. Bez external image-a (izbjegava spam filtere).

## Testovi

`tests/unit/notifications/` — 6 fajlova, 37 testova:

- Šabloni sadrže ime/uslugu/vrijeme/link
- `.ics` format (DTSTART/DTEND, escaping)
- Skip kad nema API key-a / nema client_email
- From adresa, subject linije

## Greške i retry

Slanje je **best-effort** — Resend failure se loguje (sanitizovano, bez PII), rezervacija/potvrda NIJE blokirana. Nema retry queue-a; ako email padne, WhatsApp je fallback kanal.
