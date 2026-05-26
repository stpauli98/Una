# Admin Email Notifikacija pri Rezervaciji — Design

**Status:** Approved (auto-mode, scope = email Uni samo, opcija A "nova rezervacija")
**Date:** 2026-05-12
**Author:** Nikola Milošević + Claude Opus 4.7

## Problem

Trenutno kad klijent rezerviše termin na javnoj `/zakazi` stranici, Una mora ručno da otvori admin panel i provjerava nove rezervacije. Nema automatskog obavještenja. Treba email Uni sa svim detaljima rezervacije u trenutku kad se napravi.

## Goals

- Una dobija jedan HTML email pri svakoj novoj rezervaciji (status `ceka`)
- Email sadrži: ime klijenta, telefon, email (ako postoji), uslugu, datum/vrijeme, napomenu, link na admin panel
- Email **NE blokira** rezervaciju — ako Resend pukne, klijent svejedno dobije success response
- Lokalni dev radi bez Resend account-a (graceful skip ako `RESEND_API_KEY` nije setovan)
- Plain-text fallback verzija u Resend payload-u (za clients koji ne učitavaju HTML)

## Non-goals

- Klijent ne dobija email (out-of-scope za ovu spec)
- SMS notifikacije (out-of-scope)
- Email pri promjeni statusa (`potvrdjen`, `otkazan`, `zavrsen`) — admin sam mijenja status, zna
- Daily digest cron — out-of-scope za sad
- Email template editor u admin panelu — hardkodovan template, izmjene kroz git

## Architecture

```
src/
├── lib/
│   └── notifications/
│       ├── resend.ts                ← NEW: lazy singleton Resend client
│       ├── templates.ts             ← NEW: HTML + text builder za "nova rezervacija"
│       └── send-admin-email.ts      ← NEW: high-level orchestrator
└── app/
    └── zakazi/
        └── actions.ts               ← MODIFY: poziva send-admin-email nakon INSERT-a
```

**Razdvajanje odgovornosti:**
- `resend.ts` — instancira `new Resend(apiKey)`, vraća `null` ako `RESEND_API_KEY` nije set (graceful skip). Singleton da ne kreira novi client per request.
- `templates.ts` — pure funkcija `renderNewAppointmentEmail(input)` koja vraća `{ subject, html, text }`. Bez side-effecta — lakše testirati.
- `send-admin-email.ts` — orchestrator: provjera env vars → render template → call Resend → log on error. NE throw-uje, samo loguje.

## Trigger flow

```
1. Klijent submituje formu na /zakazi
2. src/app/zakazi/actions.ts createAppointment():
   - validate input (postojeća logika)
   - INSERT u appointments tabelu (postojeća logika)
   - return { ok: true, confirmationToken } CLIENT
3. Async fire-and-log (ne await-ovano blocking):
   sendNewAppointmentEmail(inserted, service).catch(logError)
4. Klijent vidi success bez čekanja na email
```

**Bitno:** trigger se desi **nakon** uspješnog DB INSERT-a (tek kad znamo da je rezervacija sigurna). Ako email pukne, DB row je već persisted i admin može vidjeti u panelu.

## Email content

### Subject
`Nova rezervacija: {client_name} — {service_name} ({date_formatted})`

Primjer: `Nova rezervacija: Marija Kovač — Šminkanje (Pet, 15. maj 2026.)`

### HTML body (responsive)

```
┌──────────────────────────────────────┐
│  UP BEAUTY STUDIO                    │  ← gold logo text, font-display
├──────────────────────────────────────┤
│                                      │
│  Nova rezervacija                    │  ← Cormorant italic h2
│  ────                                │  ← rose accent linija
│                                      │
│  Klijent:                            │
│    Marija Kovač                      │
│    +387 65 123 456 (clickable tel:)  │
│    marija@example.com (mailto:)      │  ← samo ako klijent dao email
│                                      │
│  Termin:                             │
│    Šminkanje                         │
│    Petak, 15. maj 2026.              │
│    18:00                             │
│                                      │
│  Napomena:                           │  ← samo ako postoji
│    "Alergija na lateks"              │
│                                      │
│  [→ Otvori u admin panelu]           │  ← gold button, link na /admin/termini
│                                      │
├──────────────────────────────────────┤
│  UP Beauty & Makeup Studio           │  ← footer
│  Majora Milana Tepića 13, Gradiška   │
└──────────────────────────────────────┘
```

**Brand boje** (inline CSS, jer email klijenti ignorišu `<style>`):
- Gold: `#b8965a`
- Rose: `#c4787a`
- Dark: `#3d2b2b`
- Marble (background): `#fdfbf9`
- Body text: `#5a4545`

Font: `font-family: Georgia, 'Times New Roman', serif;` (sigurna Cormorant alternativa za email)

### Plain text body

```
NOVA REZERVACIJA — UP Beauty Studio

Klijent: Marija Kovač
Telefon: +387 65 123 456
Email: marija@example.com

Termin: Šminkanje
Datum: Petak, 15. maj 2026.
Vrijeme: 18:00

Napomena: Alergija na lateks

Otvori u admin panelu:
https://upbeauty.ba/admin/termini

--
UP Beauty & Makeup Studio
Majora Milana Tepića 13, Gradiška
```

## Configuration

**Već u `.env.example`:**
```
RESEND_API_KEY=
RESEND_FROM_EMAIL=rezervacije@upbeauty.ba
ADMIN_NOTIFICATION_EMAIL=peranovicuna6@gmail.com
```

**Postavljanje produkcijskih vrijednosti:**
1. Admin (Una/Nikola) kreira Resend account, verifikuje `upbeauty.ba` domen (DNS SPF/DKIM records)
2. Generiše API key u Resend dashboard-u
3. Postavlja `RESEND_API_KEY` na Vercel-u (dashboard → Settings → Environment Variables, production scope)
4. `RESEND_FROM_EMAIL` i `ADMIN_NOTIFICATION_EMAIL` već imaju default vrijednosti u `.env.example`

**Lokalni dev:** ako admin ne želi setupovati Resend lokalno, ostavlja `RESEND_API_KEY` prazan — kod radi `[email skipped]` log umjesto crash-a.

## Error handling

| Scenarij | Ponašanje |
|---|---|
| `RESEND_API_KEY` nije set | Skip + log "[email skipped] RESEND_API_KEY missing"; appointment se kreira normalno |
| `ADMIN_NOTIFICATION_EMAIL` nije set | Skip + log "[email skipped] ADMIN_NOTIFICATION_EMAIL missing" |
| `RESEND_FROM_EMAIL` nije set | Skip + log isto |
| Resend API vraća 4xx (npr. unverified domain) | Log error message + nastavi (rezervacija OK) |
| Resend API vraća 5xx (server error) | Log + nastavi |
| Network timeout (Vercel timeout 25s) | Promise rejection se hvata u outer `.catch()`, log + nastavi |
| HTML render fail (npr. malformed template) | Log + skip — appointment ipak kreirana |

**Svi error log-ovi prolaze kroz `sanitizeError()` da spreče leak osjetljivih info (API keys u stack trace, itd.)** — već postoji u `src/lib/utils/log.ts`.

## Testing strategija

### Unit tests (Vitest)

**`templates.test.ts`:**
- `renderNewAppointmentEmail` sa full data → subject sadrži klijent name + service + date; HTML sadrži sva polja; text sadrži sva polja
- Bez email-a klijenta → HTML/text NE prikazuje email row
- Bez napomene → HTML/text NE prikazuje napomena sekciju
- Datum formatiran u Sarajevo TZ (test sa explicit Date objektom)

**`send-admin-email.test.ts`:**
- Mock-ovan Resend client (`vi.mock("resend")`)
- Sa svim env vars → Resend `emails.send` pozvan sa pravim argumentima
- Bez `RESEND_API_KEY` → Resend NE pozvan, `console.warn` logged
- Resend baca error → funkcija ne re-throw-uje, samo loguje

### E2E test (Playwright)

**Out-of-scope za Fazu 1** — E2E testiranje Resend-a traži real API calls ili komplikovan mock setup. Unit testovi pokrivaju glavnu logiku.

Manuelni test pre merge-a:
1. Setuj test `RESEND_API_KEY` lokalno (Resend free tier 100 emails/dan u dev)
2. Rezerviši termin kroz `/zakazi` na localhost
3. Provjeri Resend dashboard "Logs" za sent email
4. Otvori email klijent → vidi HTML render

## Implementation Phases

Implementacija ide u **3 jasno odvojene faze** sa verify gate-om između svake. Sljedeća faza ne počinje dok prethodna nije completed bez grešaka.

### Phase 1 — Foundation (resend.ts + templates.ts + unit testovi)

Cilj: imati testirane "pure" module bez DB / server action integracije.

**Done when:** `npm test` pass-uje sve unit testove (templates + resend init), typecheck + lint pass.

### Phase 2 — Integration (send-admin-email.ts + actions.ts trigger)

Cilj: zakači orchestrator-a na createAppointment server action.

**Done when:** Manuelni test prolazi (rezervacija kroz lokalni `/zakazi` → email se vidi u Resend dashboard-u), typecheck + lint + build pass.

### Phase 3 — Production setup + dokumentacija

Cilj: docs + env var prep za production deploy.

**Done when:** README ima sekciju o Resend setup-u, `.env.example` komentare ažurirane, PR otvoren.

## Rollout

1. Branch `feature/resend-admin-email` sa main-a
2. 3 commit-a po fazi (Faza 1 + 2 + 3)
3. PR ka main nakon završetka Faze 3
4. Korisnik (Una/Nikola) postavlja Resend API key na Vercel-u pre merge-a
5. Merge → live na produkciji odmah
6. Smoke test: rezervisati termin na produkciji, provjeriti email

## Out of scope

- Email klijentu (separate spec u budućnosti)
- SMS (separate spec)
- Email pri otkazu/potvrdi (Una sama mijenja status, nema potrebe)
- 24h reminder cron
- Email template editor u admin panelu
- A/B testiranje subject line-a
- Unsubscribe link (admin email, nije marketing — ne treba GDPR unsubscribe)
