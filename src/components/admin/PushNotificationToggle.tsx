"use client";

import { useEffect, useState, useTransition } from "react";
import {
  subscribeAdminToPush,
  unsubscribeAdminFromPush,
  sendTestPushToCurrentAdmin,
} from "@/app/admin/(protected)/postavke/push-actions";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

/**
 * UI za upravljanje push notifikacijama u admin panelu.
 *
 * State machine:
 *  - "loading"      → provjera permission/subscription u toku
 *  - "unsupported"  → browser nema Push API ili Notifications API
 *  - "denied"       → user je odbio permission ranije (mora ručno
 *                     omogućiti u browser settings-ima)
 *  - "subscribed"   → permission granted + subscription u bazi
 *  - "unsubscribed" → permission ili granted ili default, ali nema sub
 *
 * iOS Safari special-case: Web Push radi SAMO za installed PWA. Ako
 * detektujemo unsupported, pokazujemo upute za instalaciju kao home
 * screen app.
 */
export function PushNotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        setState(sub ? "subscribed" : "unsubscribed");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  const onSubscribe = () => {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "unsubscribed");
          return;
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setError("VAPID public key nije konfigurisan.");
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const json = sub.toJSON();
        const res = await subscribeAdminToPush({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });

        if (!res.ok) {
          setError(res.error);
          return;
        }
        setState("subscribed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Subscribe failed");
      }
    });
  };

  const onTest = () => {
    setError(null);
    setTestSuccess(false);
    startTransition(async () => {
      const res = await sendTestPushToCurrentAdmin();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 4000);
    });
  };

  const onUnsubscribe = () => {
    setError(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setState("unsubscribed");
          return;
        }
        await sub.unsubscribe();
        const res = await unsubscribeAdminFromPush(sub.endpoint);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setState("unsubscribed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unsubscribe failed");
      }
    });
  };

  if (state === "loading") {
    return <p className="text-[12px] text-light">Provjeravam status…</p>;
  }

  if (state === "unsupported") {
    return (
      <div className="border border-cream bg-stone-50 p-3 text-[12px] text-body">
        Tvoj browser ne podržava web push notifikacije. Na iPhone-u:
        instaliraj &quot;UP Admin&quot; kao PWA preko Safari Share → Add
        to Home Screen, pa otvori iz home screen-a i ponovi.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="border border-cream bg-stone-50 p-3 text-[12px] text-body">
        Odbila si notifikacije ranije. Da ih omogućiš: otvori browser
        settings → site permissions → Notifications za up-beauty.vercel.app.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state === "subscribed" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUnsubscribe}
            disabled={pending}
            className="border border-rose bg-white px-4 py-2 text-[12px] text-rose hover:bg-warm disabled:opacity-50 cursor-pointer"
          >
            {pending ? "..." : "Isključi obavještenja"}
          </button>
          <button
            type="button"
            onClick={onTest}
            disabled={pending}
            className="border border-cream bg-white px-4 py-2 text-[12px] text-dark hover:border-rose hover:text-rose disabled:opacity-50 cursor-pointer"
          >
            {pending ? "..." : "Pošalji test"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSubscribe}
          disabled={pending}
          className="border border-rose bg-rose px-4 py-2 text-[12px] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {pending ? "..." : "Uključi obavještenja"}
        </button>
      )}
      {testSuccess && (
        <p className="text-[12px] text-green-700">
          ✓ Test poslat — provjeri uređaj. Ako ne vidiš notifikaciju u par
          sekundi, provjeri da li je &quot;Do Not Disturb&quot; isključen.
        </p>
      )}
      {error && <p className="text-[12px] text-rose">{error}</p>}
    </div>
  );
}

/**
 * Pretvara base64url-encoded VAPID public key u Uint8Array koji
 * PushManager.subscribe() očekuje kao applicationServerKey.
 * Standardni helper iz Web Push specs primjera.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}
