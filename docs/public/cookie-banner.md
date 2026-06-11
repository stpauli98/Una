# Cookie banner

**Fajl:** `src/components/public/CookieBanner.tsx`

GDPR cookie consent banner — pojavljuje se pri prvoj posjeti.

## Šta klijent vidi

Fiksiran na dnu ekrana (`fixed inset-x-3 bottom-3 z-[60]`):

```
┌─────────────────────────────────────┐
│  Koristimo isključivo funkcionalne  │
│  kolačiće. Saznajte više u našoj    │
│  politici privatnosti.              │
│                                     │
│  [Prihvatam]                    [X] │
└─────────────────────────────────────┘
```

- "Politika privatnosti" je link na `/politika-privatnosti`
- "Prihvatam" dugme (rose, full-width)
- X dugme (vizuelna alternativa — ponašanje identično "Prihvatam")

## Logika

```typescript
const STORAGE_KEY = "up-makeup-cookie-consent";

useEffect(() => {
  if (localStorage.getItem(STORAGE_KEY) !== "accepted") {
    setVisible(true);
  }
}, []);

const accept = () => {
  localStorage.setItem(STORAGE_KEY, "accepted");
  setVisible(false);
};
```

**Pravilo:** Banner se prikazuje samo ako `localStorage` value nije `"accepted"`.

Klikom na "Prihvatam" → set u localStorage → banner sakriven na svim sljedećim posjetama.

X dugme → poziva istu `accept()` funkciju kao "Prihvatam" (`CookieBanner.tsx:58-65`) — TAKOĐE setuje localStorage, banner se ne vraća. Nema "odbij" opcije jer sajt ne koristi tracking cookies — banner je čisto informativan.

## Šta sajt zapravo koristi

**Politika privatnosti eksplicitno navodi:**

> "Naš sajt koristi isključivo funkcionalne kolačiće. Ne koristimo analitičke niti marketinške kolačiće."

**Trenutno setovani kolačići:**

| Kolačić | Svrha | Tip |
|---------|-------|-----|
| `sb-<project>-auth-token` | Supabase Auth | Funkcionalni |
| `sb-<project>-auth-token.0`, `.1` | Sa refresh tokenom | Funkcionalni |
| `up-makeup-cookie-consent` | Saglasnost | Funkcionalni (localStorage, ne cookie) |

Nema Google Analytics, Facebook Pixel, ili sličnih.

## Accessibility

| Element | Implementacija |
|---------|----------------|
| `role="dialog"` | Da |
| `aria-label="Saglasnost za kolačiće"` | Da |
| Close button `size-10` (40px) | Da |
| Accept button `py-3` (≥44px touch) | Da |
| Keyboard navigation | Tab kroz dugmad |

## Z-index

`z-[60]` — iznad nav-a (`z-[60]` takođe), ali ispod lightbox-a (`z-[100]`).

Na mobilnom: banner na dnu, nav na vrhu — bez vizualnog konflikta.

## Lokacija u stablu

Render-uje se iz **root layout-a** (`src/app/layout.tsx`):

```tsx
<body>
  {children}
  <CookieBanner />
</body>
```

Prisutan na svim **javnim** stranicama. Na `/admin/*` rutama se NE renderuje — komponenta provjerava pathname i vraća `null` za admin (`if (isAdmin) return;`).
