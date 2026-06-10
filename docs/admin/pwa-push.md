# Admin: PWA + Push notifikacije

Admin panel kao Progressive Web App + Web Push notifikacije za nove termine.

## Admin PWA

### Manifest

**Fajl:** `src/app/admin/manifest.webmanifest/route.ts`

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
  icons: [/* 192x192, 512x512, etc. */],
}
```

### Razlika od public manifesta

| Polje | Public | Admin |
|-------|--------|-------|
| Name | "UP Makeup — Gradiška" | "UP Makeup Admin" |
| Short name | "UP Makeup" | "UP Admin" |
| Start URL | `/` | `/admin/dashboard` |
| Scope | `/` | `/admin` |

`scope: "/admin"` znači PWA radi samo unutar `/admin/*` rute. Ako Una klikne link na `/galerija` iz PWA, otvara se u browseru (ne unutar PWA).

### Install

Kad Una otvori `/admin/dashboard` u Chrome/Android:
- "+" ikona u URL bar-u → "Install"
- Nakon: dvije app ikone na home screen-u — "UP Makeup" (public) i "UP Admin"

iOS: Share → "Add to Home Screen" (Una mora biti na `/admin/...` URL-u).

### Layout u standalone mode

Kad je PWA pokrenut iz home screen-a, ima `display: standalone`:
- Bez browser chrome
- Bez URL bar-a
- `pt-safe` na nav-u (rezerviše prostor za iPhone notch)
- Native feel

## Web Push notifikacije

### Use case

Klijent rezerviše termin → Una dobija push notifikaciju na telefonu:

```
🔔 UP Makeup
Nova rezervacija: Ana Petrović
Šminkanje, sutra 17:30
```

Klik na notifikaciju → otvara `/admin/termini` (URL u payload-u).

### VAPID setup

**Fajlovi:**
- `src/lib/push/vapid.ts` — VAPID utility
- `src/lib/push/send.ts` — send funkcija

VAPID keys generišu se jednom:

```typescript
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
```

Env vars:

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHi...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:peranovicuna6@gmail.com
```

Public key se eksponira klijentu (za subscribe). Private key samo server (za send).

### Subscribe flow

`PushNotificationToggle.tsx`:

```typescript
async function subscribe() {
  if (!("serviceWorker" in navigator)) return;
  if (!("PushManager" in window)) return;

  // 1. Request permission
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return;

  // 2. Get SW registration
  const reg = await navigator.serviceWorker.ready;

  // 3. Subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  // 4. Send subscription to server
  await subscribeToPush(sub.toJSON());
}
```

Server action `subscribeToPush` (`src/app/admin/(protected)/postavke/push-actions.ts`):

```typescript
INSERT INTO push_subscriptions (
  endpoint, keys_p256dh, keys_auth, user_id
) VALUES (...)
ON CONFLICT (endpoint) DO UPDATE SET ...
```

### Send flow (na novu rezervaciju)

Kad klijent kreira termin (`createAppointment` u `src/app/zakazi/actions.ts`):

```typescript
// (TODO: dodati u finalu)
const { data: subs } = await admin
  .from("push_subscriptions")
  .select("*");

for (const sub of subs) {
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    },
    JSON.stringify({
      title: "Nova rezervacija",
      body: `${clientName} — ${serviceName}, ${dateStr}`,
      url: "/admin/termini",
    }),
  );
}
```

**Status:** Implementirano u kodu, ali ne aktivno u trenutnom flow-u (TODO Phase 8 email).

### Service Worker handle

**Fajl:** `src/app/sw.ts` (Next.js 16 service worker)

```typescript
self.addEventListener("push", (event) => {
  const data = event.data?.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-72.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url),
  );
});
```

### Unsubscribe

```typescript
async function unsubscribe() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await sub?.unsubscribe();
  await unsubscribeFromPush(sub.endpoint);  // DELETE iz DB
}
```

## Tabela `push_subscriptions`

| Kolona | Tip | Šta |
|--------|-----|-----|
| `id` | bigserial | PK |
| `endpoint` | text | Unique |
| `keys_p256dh` | text | Public key |
| `keys_auth` | text | Auth secret |
| `user_id` | uuid | FK na auth.users |
| `created_at` | timestamptz | |

RLS: samo admin može SELECT/INSERT/DELETE (kroz `is_admin()` check).

Migracija: `supabase/migrations/20260518000001_push_subscriptions.sql`

## Limiti

| Browser | Podržava |
|---------|----------|
| Chrome (Android/Desktop) | ✅ Full |
| Firefox | ✅ Full |
| Safari (macOS) | ✅ od macOS 13 |
| Safari iOS | ✅ samo PWA na home screen (16.4+) |

iOS najveće ograničenje: push radi **samo ako je PWA instaliran** kao app na home screen (ne radi u Safari browser tab-u).

## Permissions

Browser zahtijeva eksplicitnu dozvolu. Korisnik može:
- Grant → push radi
- Deny → push ne radi, ne može se ponovo pitati (mora ručno u settings-u)
- Default → svaki put pitaj (`Notification.requestPermission`)

Una uključi push jednom, koristi do unsubscribe-a.
