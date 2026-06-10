# Admin panel — pregled

Sve što Una vidi nakon login-a na `/admin/...`.

## Routing

```
/admin
  ├── /admin/login              # Public (jedini neauth-guard)
  ├── /admin                    # Redirect na /admin/dashboard
  └── /admin/(protected)/       # Auth-guarded route group
      ├── /admin/dashboard      # Statistike
      ├── /admin/termini        # Termini
      ├── /admin/usluge         # Usluge
      ├── /admin/galerija       # Galerija
      └── /admin/postavke       # Postavke
```

## Layout

**Fajl:** `src/app/admin/(protected)/layout.tsx`

Sve `(protected)/` rute dijele isti layout:

```tsx
<AdminShell userEmail={user.email}>
  {children}
</AdminShell>
```

`AdminShell` (`src/components/admin/AdminShell.tsx`):

| Layout | Desktop | Mobile |
|--------|---------|--------|
| Sidebar | Fixed lijevo, 240px wide, sticky | — |
| Bottom nav | — | Fixed bottom, 5-col tab bar |
| Content | Padding-left za sidebar | Padding-bottom za nav |

### Sidebar (desktop)

```
┌─────────────┐
│  UP         │  ← Logo
│  Makeup     │
│  Admin      │
├─────────────┤
│ Dashboard   │
│ Termini     │ ← Active highlight
│ Usluge      │
│ Galerija    │
│ Postavke    │
├─────────────┤
│  Email      │
│  Sign out   │
└─────────────┘
```

### Bottom nav (mobile)

```
┌───┬───┬───┬───┬───┐
│ 🏠 │ 📅 │ 📋 │ 🖼  │ ⚙  │
│Poč│Ter│Usl│Gal│Više│
└───┴───┴───┴───┴───┘
```

5 tab-ova: Dashboard, Termini, Usluge, Galerija, Postavke ("Više").

## Auth check (proxy.ts)

Prije render-a bilo koje admin rute (osim login):

```typescript
// src/proxy.ts
if (!user || !ADMIN_EMAILS.has(user.email ?? "")) {
  return NextResponse.redirect("/admin/login?redirect=" + pathname);
}
```

`ADMIN_EMAILS` lista: `src/lib/auth/admin-emails.ts`

Detalji: [../security/auth.md](../security/auth.md)

## Server actions

Sve mutation operacije idu kroz server actions. Svaki fajl:

| Fajl | Funkcije |
|------|----------|
| `src/app/admin/(protected)/termini/actions.ts` | `confirmAppointment`, `cancelAppointment`, `markCompleted`, `createManualAppointment` |
| `src/app/admin/(protected)/usluge/actions.ts` | `createService`, `updateService`, `deleteService`, `reorderService`, `toggleServiceActive` |
| `src/app/admin/(protected)/galerija/actions.ts` | `uploadSingleGalleryImage`, `deleteGalleryImage`, `deleteGalleryImages`, `revalidateGallery` |
| `src/app/admin/(protected)/postavke/actions.ts` | `updateWorkingHour`, `addBlockedDate`, `removeBlockedDate`, `updateSetting`, `changePassword`, `createTimeBlock`, `deleteTimeBlock` |
| `src/app/admin/(protected)/postavke/push-actions.ts` | `subscribeToPush`, `unsubscribeFromPush` |

**Svaki action koristi `requireAdmin()`** iz `src/lib/supabase/require-admin.ts`:

```typescript
export async function someAction(...) {
  try {
    const sb = await requireAdmin();
    // ... logika
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
```

`requireAdmin()` baca grešku ako user nije autentifikovan ILI nije u admin whitelist-i.

## Data fetching pattern

Server komponente fetch direktno iz baze:

```typescript
// src/app/admin/(protected)/termini/page.tsx
export const dynamic = "force-dynamic";

export default async function TerminiPage() {
  const sb = await createClient();
  const { data: appointments } = await sb
    .from("appointments")
    .select("*, services(name)")
    .order("start_time");
  
  return <AppointmentsList items={appointments} />;
}
```

`force-dynamic` na svim admin stranicama — uvijek svježi podaci, bez ISR cache-a.

## Komponente

| Komponenta | Fajl | Use case |
|-----------|------|----------|
| `AdminShell` | `src/components/admin/AdminShell.tsx` | Layout wrapper |
| `PageHeader` | `src/components/admin/PageHeader.tsx` | Title + opis na vrhu svake stranice |
| `LoginForm` | `src/components/admin/LoginForm.tsx` | Login |
| `AppointmentRow` | `src/components/admin/AppointmentRow.tsx` | 1 termin u listi |
| `AppointmentsRealtime` | `src/components/admin/AppointmentsRealtime.tsx` | Live update |
| `ServicesManager` | `src/components/admin/ServicesManager.tsx` | Usluge CRUD UI |
| `ServiceForm` | `src/components/admin/ServiceForm.tsx` | Add/edit modal |
| `GalleryManager` | `src/components/admin/GalleryManager.tsx` | Galerija UI |
| `WorkingHoursEditor` | `src/components/admin/WorkingHoursEditor.tsx` | Radno vrijeme |
| `BlockedDatesManager` | `src/components/admin/BlockedDatesManager.tsx` | Blokirani dani |
| `TimeBlocksManager` | `src/components/admin/TimeBlocksManager.tsx` | Pod-dan blokade |
| `BookingRulesEditor` | `src/components/admin/BookingRulesEditor.tsx` | Settings |
| `ChangePasswordForm` | `src/components/admin/ChangePasswordForm.tsx` | Promjena lozinke |
| `ManualAppointmentForm` | `src/components/admin/ManualAppointmentForm.tsx` | Una unosi za klijenta |
| `PushNotificationToggle` | `src/components/admin/PushNotificationToggle.tsx` | Push on/off |
| `DashboardDayPicker` | `src/components/admin/DashboardDayPicker.tsx` | Dashboard day nav |
| `StatusBadge` | `src/components/admin/StatusBadge.tsx` | "ceka" / "potvrdjen" / itd. badge |
| `TerminiToolbar` | `src/components/admin/TerminiToolbar.tsx` | Filter dugmad |
| `TerminiStatusFilter` | `src/components/admin/TerminiStatusFilter.tsx` | Status dropdown |
| `TerminiSortToggle` | `src/components/admin/TerminiSortToggle.tsx` | Sort dropdown |

## Realtime

Admin termini stranica koristi Supabase Realtime za live update:

```typescript
// AppointmentsRealtime.tsx
const channel = sb
  .channel("appointments-changes")
  .on("postgres_changes", { event: "*", table: "appointments" }, (payload) => {
    router.refresh(); // re-fetch server data
  })
  .subscribe();
```

Kad klijent rezerviše termin, Una ga vidi unutar 1-2 sekunde bez refresh-a.

Detalji: [realtime.md](./realtime.md)

## PWA + Push

Admin može instalirati admin panel kao PWA app (odvojeno od public). Push notifikacije za nove rezervacije.

Detalji: [pwa-push.md](./pwa-push.md)

## Sledeće

- [login.md](./login.md) — auth flow
- [dashboard.md](./dashboard.md) — statistike
- [termini.md](./termini.md) — najveća funkcionalnost
