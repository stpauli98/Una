# Admin: `/admin/dashboard` — Dashboard

**Fajl:** `src/app/admin/(protected)/dashboard/page.tsx`

Početna stranica nakon login-a. Pregled svega bitnog.

## Sekcije

### 1. Stat cards (4 brojke)

| Card | Brojka | Period |
|------|--------|--------|
| Termini danas | Count | Današnji dan |
| Ova sedmica | Count | `startOfWeek(now, {weekStartsOn: 1})` do kraja |
| Ovaj mjesec | Count | `startOfMonth` do `endOfMonth` |
| Prihod mjesec | KM iznos | Suma `price` svih `zavrsen` u mjesecu |

Filter: samo `status IN ('ceka', 'potvrdjen', 'zavrsen')` (ne otkazani).

Layout: `grid grid-cols-2 lg:grid-cols-4 gap-4`.

### 2. Domain warning (uvjetno)

Ako `NEXT_PUBLIC_SITE_URL` nije postavljen ili sadrži `localhost`:

```
⚠ Domena nije podešena
NEXT_PUBLIC_SITE_URL je još uvijek na localhost. SEO,
sitemap i OG slike neće raditi ispravno dok se ne podesi
produkcijska domena u Vercel environment varijablama.
```

Yellow warning. Nestaje kad se URL podesi.

### 3. Today's appointments

Lista termina za izabrani dan (day picker omogućava skok na drugi dan).

`DashboardDayPicker` komponenta — strelice prev/next + datum.

Lista koristi isti `AppointmentRow` komponentu kao `/admin/termini`.

## Day picker (kompon.)

**Fajl:** `src/components/admin/DashboardDayPicker.tsx`

```
← Srijeda, 15. april  →
```

`<` i `>` prebacuju za 1 dan. URL `?date=YYYY-MM-DD` se update-uje.

## Data fetching

```typescript
const sb = await createClient();
const now = new Date();
const dateParam = searchParams.date ?? format(now, "yyyy-MM-dd");
const date = parseDateSarajevo(dateParam);

// Fetch today's
const { data: todayAppointments } = await sb
  .from("appointments")
  .select("*, services(name, price)")
  .gte("start_time", date.toISOString())
  .lt("start_time", addDays(date, 1).toISOString())
  .in("status", ["ceka", "potvrdjen", "zavrsen"])
  .order("start_time");

// Stats counts (Promise.all za parallel)
const [todayCount, weekCount, monthCount, monthRevenue] = await Promise.all([...]);
```

`force-dynamic` — uvijek svježi podaci.

## Performance

Sve fetches paralelno (Promise.all). Stat cards su brze (count queries).

## Sledeće

- [termini.md](./termini.md) — detaljniji prikaz termina
