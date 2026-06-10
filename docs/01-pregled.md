# 01 · Pregled projekta

## Šta je UP Makeup

UP Makeup je **produkcijski sajt + admin panel** za beauty studio Une Peranović u Gradišci (Bosna i Hercegovina).

Sajt rješava 4 glavne potrebe:

1. **Prezentacija** — galerija radova, lista usluga sa cijenama, info o vlasnici
2. **Online rezervacija termina** — klijent bira uslugu, datum, vrijeme, ostavlja kontakt
3. **Admin panel** — Una upravlja terminima, uslugama, galerijom, postavkama
4. **WhatsApp komunikacija** — sve poruke klijentima idu preko WhatsApp-a (ne email-a)

## Glavne funkcije

### Za klijente (javni sajt)

| Funkcija | URL | Šta omogućava |
|----------|-----|----------------|
| Početna | `/` | Prvi utisak — hero, top usluge, testimoniali |
| Usluge | `/usluge` | Lista svih usluga sa cijenama i trajanjima |
| Cjenovnik | `/cjenovnik` | Tabelarni prikaz cijena po kategorijama |
| Galerija | `/galerija` | Slike radova sa lightbox + swipe |
| O meni | `/o-meni` | Predstavljanje Une, ko je |
| Kontakt | `/kontakt` | Telefon, mape, social linkovi |
| Obuka | `/obuka` | Info o edukaciji + CTA na WhatsApp |
| Zakaži termin | `/zakazi` | 3-step booking flow |
| Pravne stranice | `/politika-privatnosti`, `/uslovi-koriscenja` | GDPR + uslovi |

### Za Unu (admin panel)

| Sekcija | URL | Šta omogućava |
|---------|-----|----------------|
| Login | `/admin/login` | Email + password, samo whitelisted emaili |
| Dashboard | `/admin/dashboard` | Statistike, današnji + sutrašnji termini |
| Termini | `/admin/termini` | Lista svih, filteri, status promjena, WhatsApp dugmad |
| Usluge | `/admin/usluge` | Dodavanje/izmjena/brisanje, reorder, toggle active |
| Galerija | `/admin/galerija` | Drag-drop upload, batch delete, lightbox preview |
| Postavke | `/admin/postavke` | Radno vrijeme, blokade, booking pravila, promjena lozinke |

## Korisnici sistema

| Tip | Ko | Pristup |
|-----|----|---------|
| **Klijent** (anon) | Bilo ko sa interneta | Javni sajt, može rezervisati termin |
| **Admin** | Una (`peranovicuna6@gmail.com`) | Pun pristup admin panelu |
| **Dev admin** (test) | `test@admin.com` | Samo za E2E testove |

Lista admin email-ova: `src/lib/auth/admin-emails.ts`

## Biznis pravila

| Pravilo | Default | Konfigurabilno |
|---------|---------|----------------|
| Slot interval | 30 minuta | ❌ Fiksno (Cal.com pattern) |
| Min sati prije rezervacije | 24 sata | ✅ `min_hours_before` u `settings` |
| Max dana unaprijed | 90 dana | ✅ `advance_booking_days` |
| Pauza između termina | 0 minuta | ✅ `break_between_min` |
| Otkazivanje termina | 24h prije | ✅ `cancellation_hours` |
| Radno vrijeme — radni dani | 17:00–21:00 | ✅ `working_hours` tabela |
| Radno vrijeme — vikend | 05:00–21:00 | ✅ `working_hours` tabela |

## Kategorije usluga

Sve usluge spadaju u jednu od 4 kategorije:

| Kategorija | Primjer | Trajanje (raspon) | Cijena (raspon) |
|------------|---------|-------------------|-----------------|
| **Šminkanje** | Šminkanje, terensko, svadbeno | 45–120 min | 60–150 KM |
| **Pedikir** | Spa, estetski, jelly | 60 min | 40–70 KM |
| **Trepavice** | Trepavice 1:1 | 180 min | 60 KM |
| **Obuka** | Obuka za šminkanje | 5 dana | 800 KM |

Una je **jedan resurs** — može raditi samo jednu uslugu u isto vrijeme. Booking engine to forsira (cross-service blocking).

## Status termina

Termin može biti u jednom od 4 statusa:

| Status | Šta znači | Ko ga postavlja |
|--------|-----------|------------------|
| `ceka` | Klijent rezervisao, Una nije potvrdila | Sistem pri rezervaciji |
| `potvrdjen` | Una potvrdila, slot zauzet | Una u admin panelu |
| `otkazan` | Termin otkazan, slot oslobođen | Una u admin panelu |
| `zavrsen` | Termin obavljen u prošlosti | Una u admin panelu |

Slotovi se računaju kao zauzeti samo za status `ceka` ili `potvrdjen`. Otkazani i završeni se ne računaju.

## WhatsApp integracija

Svi pozivi za komunikaciju idu kroz `wa.me/{phoneRaw}?text={message}` deep linkove — ne kroz API. To znači:

- Sajt ne **šalje** WhatsApp poruke automatski
- Sajt **otvara WhatsApp app** sa pre-popunjenom porukom
- Una potvrdi/pošalje sama

Funkcije:
- `buildAppointmentWaMessage(input)` — generiše poruku zavisno od statusa termina
- `waLink(phoneRaw, text)` — wa.me link sa URL-encoded porukom

Fajl: `src/lib/utils/wa-messages.ts`, `src/lib/utils/wa.ts`

## Šta sajt NE radi

Eksplicitno **isključeno** za sada (po želji Une):

- ❌ Email notifikacije klijentima (`Resend` paket postoji, ali se ne koristi — sve preko WhatsApp-a)
- ❌ Online plaćanje (sve dogovorom u studiju)
- ❌ SMS notifikacije
- ❌ Multi-language (samo srpski/latinica)
- ❌ Više admin korisnika (samo Una)

## Vremenska zona

Cijeli sistem radi u **`Europe/Sarajevo`** zoni (CET / CEST). Detaljno: [`booking-engine/timezone.md`](./booking-engine/timezone.md).

## Mjerne jedinice i format

- **Cijena:** Konvertibilne marke (KM), bez decimala — `120 KM`
- **Telefon:** `+387 65 810 323` za prikaz, `38765810323` za `wa.me` link
- **Datum:** `srijeda, 15. april` (ijekavica)
- **Vrijeme:** `17:30` (24-časovni format)

Format helperi: `src/lib/utils/format.ts`
