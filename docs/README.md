# UP Makeup — Dokumentacija

Kompletna tehnička dokumentacija sajta i admin panela za **UP Makeup** beauty studio (Una Peranović, Gradiška, BiH).

> **Domena:** [upmakeup.ba](https://upmakeup.ba) · **Stack:** Next.js 16 + Supabase + Vercel · **Jezik:** TypeScript

---

## Brzi start za nove developere

1. Pročitaj [01-pregled.md](./01-pregled.md) za biznis kontekst
2. Pročitaj [02-tehnologije.md](./02-tehnologije.md) za tech stack
3. Pročitaj [03-arhitektura.md](./03-arhitektura.md) za folder strukturu i data flow
4. Setup lokalno: [testing/docker-setup.md](./testing/docker-setup.md)

## Struktura dokumentacije

### 📖 Osnovni pregled

| Fajl | Šta sadrži |
|------|------------|
| [01-pregled.md](./01-pregled.md) | Šta je UP Makeup, glavne funkcije, korisnici |
| [02-tehnologije.md](./02-tehnologije.md) | Tech stack, dependency lista, verzije |
| [03-arhitektura.md](./03-arhitektura.md) | Folder struktura, data flow, ključni patterns |

### 🌐 Javni sajt (`docs/public/`)

| Stranica | Path | Opis |
|----------|------|------|
| [Početna](./public/pocetna.md) | `/` | Hero, usluge preview, o meni, testimonials |
| [Usluge](./public/usluge.md) | `/usluge` | Katalog sa kategorijama |
| [Cjenovnik](./public/cjenovnik.md) | `/cjenovnik` | Cijene grupiše po kategorijama |
| [Galerija](./public/galerija.md) | `/galerija` | Slike sa lightbox + swipe |
| [O meni](./public/o-meni.md) | `/o-meni` | Predstavljanje Une |
| [Kontakt](./public/kontakt.md) | `/kontakt` | Telefon, mape, social |
| [Obuka](./public/obuka.md) | `/obuka` | Edukacija sa CTA na WhatsApp |
| [Zakaži termin](./public/zakazi.md) | `/zakazi` | 3-step booking flow |
| [Pravne stranice](./public/pravne-stranice.md) | `/politika-privatnosti`, `/uslovi-koriscenja` | GDPR + uslovi |
| [Cookie banner](./public/cookie-banner.md) | Globalno | Saglasnost za kolačiće |
| [PWA](./public/pwa.md) | Globalno | Install na home screen |

### 🔐 Admin panel (`docs/admin/`)

| Funkcija | Path | Opis |
|----------|------|------|
| [Login](./admin/login.md) | `/admin/login` | Auth sa email whitelist |
| [Dashboard](./admin/dashboard.md) | `/admin/dashboard` | Statistike + današnji termini |
| [Termini](./admin/termini.md) | `/admin/termini` | Upravljanje rezervacijama |
| [Manuelni termin](./admin/manuelni-termin.md) | Modal | Una unosi termin za klijenta |
| [Usluge](./admin/usluge.md) | `/admin/usluge` | CRUD usluga, reorder |
| [Galerija](./admin/galerija.md) | `/admin/galerija` | Upload, batch delete |
| [Postavke](./admin/postavke.md) | `/admin/postavke` | Radno vrijeme, blokade, pravila |
| [PWA + Push](./admin/pwa-push.md) | Globalno | Install + push notifikacije |
| [Realtime](./admin/realtime.md) | Globalno | Live update termina |

### ⚙️ Booking engine (`docs/booking-engine/`)

Srce aplikacije — logika rezervacija termina.

| Tema | Fajl | Šta pokriva |
|------|------|-------------|
| Pregled | [README.md](./booking-engine/README.md) | High-level data flow booking-a |
| Availability engine | [availability.md](./booking-engine/availability.md) | `computeAvailableSlots()` čisti algoritam |
| 30-min grid | [grid.md](./booking-engine/grid.md) | Fiksni slot interval, alignment validacija |
| Timezone | [timezone.md](./booking-engine/timezone.md) | Europe/Sarajevo helperi |
| Radno vrijeme | [working-hours.md](./booking-engine/working-hours.md) | Po danu u sedmici |
| Blokirani dani | [blocked-dates.md](./booking-engine/blocked-dates.md) | Cijeli dani van funkcije |
| Time blocks | [time-blocks.md](./booking-engine/time-blocks.md) | Pod-dan blokade (pauza, privatno) |
| Booking pravila | [settings.md](./booking-engine/settings.md) | `min_hours_before`, `break_between_min`... |
| Race condition | [race-conditions.md](./booking-engine/race-conditions.md) | DB exclusion constraint + app race guard |
| Confirmation token | [confirmation-token.md](./booking-engine/confirmation-token.md) | UUID umjesto sekv. ID (anti-IDOR) |

### 🛡️ Sigurnost (`docs/security/`)

| Tema | Fajl |
|------|------|
| Pregled sigurnosti | [README.md](./security/README.md) |
| RLS politike | [rls-policies.md](./security/rls-policies.md) |
| `is_admin()` funkcija | [is-admin.md](./security/is-admin.md) |
| Rate limiting | [rate-limiting.md](./security/rate-limiting.md) |
| Autentikacija | [auth.md](./security/auth.md) |
| Validacija upload-a | [file-upload.md](./security/file-upload.md) |
| HTTP headers | [headers.md](./security/headers.md) |
| Signup disabled | [signup-disabled.md](./security/signup-disabled.md) |

### 🚀 Deployment (`docs/deployment/`)

| Tema | Fajl |
|------|------|
| Pregled | [README.md](./deployment/README.md) |
| Vercel | [vercel.md](./deployment/vercel.md) |
| Supabase produkcija | [supabase.md](./deployment/supabase.md) |
| Domena (upmakeup.ba) | [domain.md](./deployment/domain.md) |
| Environment variables | [env-vars.md](./deployment/env-vars.md) |
| Migration management | [migrations.md](./deployment/migrations.md) |

### 🧪 Testiranje (`docs/testing/`)

| Tema | Fajl |
|------|------|
| Pregled | [README.md](./testing/README.md) |
| Docker setup | [docker-setup.md](./testing/docker-setup.md) |
| Unit testovi (304) | [unit-tests.md](./testing/unit-tests.md) |
| E2E testovi (14+) | [e2e-tests.md](./testing/e2e-tests.md) |
| Test komande | [npm-scripts.md](./testing/npm-scripts.md) |

### 📚 Reference (`docs/reference/`)

| Tema | Fajl |
|------|------|
| Sve npm skripte | [npm-scripts.md](./reference/npm-scripts.md) |
| Sve env varijable | [env-vars-list.md](./reference/env-vars-list.md) |
| Sve migracije (istorijat) | [migrations-list.md](./reference/migrations-list.md) |

### 📂 Superpowers istorija (`docs/superpowers/`)

Arhiva planova za feature-e (kreirani sa superpowers/writing-plans skill-om tokom razvoja). Pogledaj ovdje da vidiš **zašto** je nešto urađeno na određeni način.

## Konvencije ove dokumentacije

- **Srpski (latinica)** za korisničke opise
- **Engleski** za tehničke pojmove, API nazive, kod
- **File references:** `src/foo/bar.tsx:42` — direktan link na fajl + liniju
- **Code blocks** sa jezik tag-om za syntax highlighting
- **Tabele** umjesto liste gdje god je moguće za scanability

## Održavanje dokumentacije

Kad dodajete novi feature:

1. Napravi plan u `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` (koristeći `superpowers:writing-plans` skill)
2. Implementiraj feature
3. Ažuriraj relevantnu `docs/<category>/<feature>.md` ili kreiraj novu
4. Update relevantni `README.md` indekse ako se feature shema mijenja

## Kontakt

- **Vlasnica biznisa:** Una Peranović (peranovicuna6@gmail.com)
- **Tehnički kontakt:** NextPixel (nmil322@icloud.com)
