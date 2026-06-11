# `/obuka` — Obuka za šminkanje

**Fajl:** `src/app/obuka/page.tsx`

Stranica za promociju obuke za šminkanje koju Una nudi.

## Šta klijent vidi

### Header

- Eyebrow: "Edukacija"
- H2: "Obuka za šminkanje"
- Uvodni paragraf

### "Šta dobijate" kartice

4 kartice (2 col tablet, 1 col mobile):

| Ikona | Naslov | Opis |
|-------|--------|------|
| Clock | 5 dana | Intenzivan program |
| Sparkles | Praktičan rad | Stvarni modeli |
| Users | Male grupe | Maksimalna posvećenost |
| BookOpen | Materijali | Teorija + alati + njega kože |

### Cijena

Kartica sa centriranim layout-om:
- "Cijena obuke" (rose eyebrow)
- "800 KM" (large, font-display)
- "Uplata u dvije rate moguća po dogovoru"

Tipografija: `text-5xl md:text-6xl font-display` (responsive — mobile manje, desktop veće).

### CTA sekcija

H3: "Zainteresovani?"

Paragraf: "Javite se direktno putem WhatsApp-a ili telefona za sve detalje..."

2 dugmeta (`flex flex-col sm:flex-row`):
- "Pišite na WhatsApp" (green) → `wa.me/...?text="Zdravo Una, zanima me obuka..."`
- "Pozovite +387 65 810 323" (outline) → `tel:`

## Razlog za WhatsApp/tel umjesto forme

Originalno je postojala `TrainingInquiryForm` koja je slala upit u bazu (`training_inquiries` tabela). **Uklonjeno** jer:

1. Korisnici u BiH rijetko koriste email
2. WhatsApp je primarni kanal komunikacije
3. Direkran kontakt = brži odgovor

Tabela `training_inquiries` postoji u bazi ali se ne koristi (može se ukloniti u budućoj migraciji).

## SEO

| Element | Vrijednost |
|---------|-----------|
| Title | "Obuka za šminkanje" |
| Description | "Intenzivna obuka za šminkanje u UP Makeup..." |
| Breadcrumb | Početna > Obuka |
