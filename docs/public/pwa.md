# PWA — Progressive Web App

Sajt je instalabilan kao app na home screen (iOS, Android, desktop).

## 2 manifesta

| Manifest | Fajl | Za koga |
|----------|------|---------|
| Public PWA | `src/app/manifest.webmanifest/route.ts` | Klijenti |
| Admin PWA | `src/app/admin/manifest.webmanifest/route.ts` | Una |

Različita: ime, ikone, scope. Allow Una da instalira admin kao odvojenu "app" na home screen.

## Public manifest

```typescript
{
  name: "UP Makeup — Gradiška",
  short_name: "UP Makeup",
  description: "Profesionalno šminkanje...",
  start_url: "/",
  scope: "/",
  display: "standalone",
  theme_color: "#3d2b2b",
  background_color: "#fdfbf9",
  icons: [...]
}
```

## Admin manifest

```typescript
{
  name: "UP Makeup Admin",
  short_name: "UP Admin",
  description: "Admin panel za UP Makeup...",
  start_url: "/admin/dashboard",
  scope: "/admin",
  display: "standalone",
  theme_color: "#3d2b2b",
  background_color: "#fdfbf9",
  icons: [...]
}
```

## Ikone

| Fajl | Veličina | Za koga |
|------|---------|---------|
| `src/app/icon.tsx` | 32×32 | Public favicon |
| `src/app/icon1.tsx` | 192×192 | Public PWA |
| `src/app/apple-icon.tsx` | 180×180 | iOS public |
| `src/app/admin/icon.tsx` | 32×32 | Admin favicon |
| `src/app/admin/icon1.tsx` | 192×192 | Admin PWA |
| `src/app/admin/apple-icon.tsx` | 180×180 | iOS admin |
| `public/apple-touch-icon.png` | 180×180 | Backup static |

Sve generisane dinamicki preko `ImageResponse` (Next.js OG/Icon API).

## Service worker

**Fajl:** `src/app/sw.ts`

Next.js 16 podržava `sw.ts` u app direktorijumu — automatski se registruje.

**Šta cache-uje:**
- Statične fajlove (font, CSS, JS)
- Image responses
- **Ne** cache-uje admin rute (sigurnosno)
- **Ne** cache-uje API odgovore (`/api/availability`)

## Offline page

**Fajl:** `src/app/~offline/page.tsx`

Tilde prefix `~offline` je Next.js konvencija za fallback rute. Service worker servuje ovu stranicu kad korisnik nema internet.

Sadržaj: Brand logo + "Nema internet konekcije" + dugme "Pokušaj ponovo".

## Install prompt

**Komponenta:** `src/components/public/InstallPrompt.tsx`

Detektuje `beforeinstallprompt` event (Chrome/Android). Pokazuje custom UI sa "Dodaj na home screen" dugme.

iOS nema `beforeinstallprompt` — koristi `display-mode` media query da prikaže instrukcije ("U Safari-ju klikni Share → Add to Home Screen").

## Push notifikacije (admin only)

**Fajlovi:**
- `src/lib/push/vapid.ts` — VAPID key generation
- `src/lib/push/send.ts` — slanje push poruke (server)
- `src/components/admin/PushNotificationToggle.tsx` — Una uključuje/isključuje
- `src/app/admin/(protected)/postavke/push-actions.ts` — subscribe/unsubscribe actions

**Use case:** Kad klijent rezerviše termin, Una dobija push notifikaciju na telefonu (ako je admin PWA instaliran i push uključen).

Detalji: [../admin/pwa-push.md](../admin/pwa-push.md)

## Test PWA install

| Uređaj | Kako |
|--------|------|
| Chrome (desktop) | URL bar → ikona "+" → "Install" |
| Android Chrome | Menu → "Add to Home Screen" |
| iOS Safari | Share button → "Add to Home Screen" |

## Service worker debugging

Chrome DevTools → Application → Service Workers → status, unregister, update.

Ili: `chrome://serviceworker-internals/`
