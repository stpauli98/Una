# Pravne stranice

## `/politika-privatnosti`

**Fajl:** `src/app/politika-privatnosti/page.tsx`

GDPR-usklađena politika privatnosti.

### Sadržaj (97 linija)

1. **Uvod** — ko smo, kontakt
2. **Koje podatke prikupljamo:**
   - Ime i prezime
   - Telefon (obavezno)
   - Email (opciono)
   - Napomena (opciono)
   - Datum termina, izabrana usluga
3. **Svrha obrade** — komunikacija oko termina
4. **Period čuvanja** — 12 mjeseci nakon termina
5. **Prava korisnika:**
   - Pravo na pristup
   - Pravo na ispravku
   - Pravo na brisanje
   - Pravo na prigovor
6. **Kolačići** — samo funkcionalni (sesija, cookie consent)
7. **Sigurnost** — RLS, šifrovan prenos
8. **Kontakt:** `peranovicuna6@gmail.com`

### Last updated

April 2026 (datum naveden u dokumentu).

## `/uslovi-koriscenja`

**Fajl:** `src/app/uslovi-koriscenja/page.tsx`

Uslovi korišćenja sajta i usluga.

### Sadržaj (123 linije)

1. **Uvod** — vlasništvo, kontakt
2. **Rezervacije:**
   - Online preko `/zakazi`
   - Min 24h unaprijed
   - Max 90 dana unaprijed
   - Una potvrđuje termine WhatsApp-om
3. **Otkazivanje:**
   - Min 24h prije termina
   - Bez naknade
4. **No-show:**
   - 15 minuta čekanja
   - Nakon: termin se smatra propalim
5. **Zdravlje:**
   - Klijent obavještava o alergijama, kožnim oboljenjima
   - Una zadržava pravo da odbije ako postoji rizik
6. **Plaćanje** — gotovinski u studiju, nakon termina
7. **Cijene:**
   - U KM
   - Mogu se mijenjati bez najave
   - Cijena fiksna jednom potvrđena
8. **Intelektualna svojina:**
   - Slike u galeriji su vlasništvo studija
   - Klijent može tražiti uklanjanje svoje slike

### Last updated

April 2026.

## Footer linkovi

Oba dokumenta se linkuju iz:

| Mjesto | Komponenta |
|--------|-----------|
| Footer | `src/components/public/Footer.tsx` |
| Cookie banner | `src/components/public/CookieBanner.tsx` |

## SEO

| Stranica | Title | Description |
|----------|-------|-------------|
| Politika privatnosti | "Politika privatnosti" | "Politika privatnosti UP Makeup" |
| Uslovi korišćenja | "Uslovi korišćenja" | "Uslovi korišćenja sajta i usluga UP Makeup" |

Statična generacija, bez ISR.
