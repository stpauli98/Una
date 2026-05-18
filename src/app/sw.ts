import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Bypass SW completely for admin routes.
 *
 * Mora se registrovati PRIJE `serwist.addEventListeners()` — naš listener
 * poziva stopImmediatePropagation() koji sprječava Serwist's listener da
 * se pokrene za isti event, pa onda respondWith(fetch(...)) prosljeđuje
 * request direktno na network. Net effect: admin fetch ide direktno na
 * network bez ikakvog SW posredovanja, bez InvalidStateError noise-a.
 *
 * Zašto bypass umjesto NetworkOnly: NetworkOnly handler baca
 * "FetchEvent.respondWith received an error: no-response" kad mreža
 * fail-uje (mobilna mreža, Vercel cold start, slab signal). Naš bypass
 * koristi raw fetch() koji baca standardni TypeError pri network fail-u,
 * što browser prikazuje kao native network error (čitljiviji za korisnika).
 *
 * Admin nije offline-functional (zahtijeva Supabase Auth + DB), pa
 * gubitak SW caching-a za admin je 0 — samo dobitak na pouzdanosti.
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/admin")) {
    // stopImmediatePropagation() sprječava Serwist's fetch listener da se
    // uopšte pokrene za ovaj event. Bez ovoga, oba listenera rade (W3C
    // spec) i Serwist's pokušaj respondWith() baca InvalidStateError u
    // konzolu — funkcionalno OK ali noisy.
    //
    // respondWith(fetch(...)) prosljeđuje request direktno na network —
    // bez ikakvog SW caching-a. Ako mreža fail-uje, browser pokazuje
    // standardni network error (kao da nema SW), umjesto SW-baced
    // "no-response" greške.
    event.stopImmediatePropagation();
    event.respondWith(fetch(event.request));
  }
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
  runtimeCaching: [
    // Block API routes — booking availability must be real-time.
    {
      matcher: ({ url }) => url.pathname.startsWith("/api"),
      handler: new NetworkOnly(),
    },
    // Booking flow — always network (real-time data).
    {
      matcher: ({ url }) => url.pathname.startsWith("/zakazi"),
      handler: new NetworkOnly(),
    },
    // Supabase storage images — immutable, cache-first 30d.
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") &&
        url.pathname.startsWith("/storage/v1/object/public/"),
      handler: new CacheFirst({
        cacheName: "supabase-storage",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // Next.js optimized images — stale-while-revalidate.
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/image"),
      handler: new StaleWhileRevalidate({
        cacheName: "next-image",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Static chunks — cache-first (hashed, immutable).
    {
      matcher: ({ url }) => url.pathname.startsWith("/_next/static"),
      handler: new CacheFirst({ cacheName: "next-static" }),
    },
    // HTML navigation — network-first with offline fallback (3s timeout).
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new NetworkFirst({
        cacheName: "html-pages",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          }),
        ],
      }),
    },
    // Fall back to default Serwist strategies for everything else (fonts, etc.).
    ...defaultCache,
  ],
});

/**
 * Push notification handler za admin (Phase C).
 *
 * Server šalje payload kao JSON string sa { title, body, url }.
 * SW prikazuje notifikaciju preko showNotification(), a click event
 * (notificationclick listener ispod) otvara URL u browser-u/PWA.
 *
 * Ako parsing failuje (corrupted payload), fallback na generic
 * "Nova rezervacija" tekst.
 */
self.addEventListener("push", (event) => {
  const payloadText = event.data?.text() ?? "";
  let payload: { title: string; body: string; url: string };
  try {
    payload = JSON.parse(payloadText);
  } catch {
    payload = {
      title: "Nova rezervacija",
      body: "Imate novu rezervaciju u admin panelu.",
      url: "/admin/termini",
    };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/admin/icon",
      badge: "/admin/icon",
      data: { url: payload.url },
      tag: "new-appointment",
      requireInteraction: false,
    }),
  );
});

/**
 * Klik na notifikaciju → fokusira postojeći admin tab ako postoji,
 * inače otvara novi prozor.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data as { url?: string } | undefined)?.url ??
    "/admin/termini";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url.includes("/admin") && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

serwist.addEventListeners();
