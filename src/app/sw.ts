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
    // Block admin routes — never cache auth/mutation surface.
    {
      matcher: ({ url }) => url.pathname.startsWith("/admin"),
      handler: new NetworkOnly(),
    },
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

serwist.addEventListeners();
