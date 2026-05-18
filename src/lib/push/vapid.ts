import "server-only";
import webpush from "web-push";

/**
 * Konfiguriše web-push library sa VAPID kredencijalima iz env vars-a.
 * Poziva se jednom (lazy) prije prvog sendNotification poziva.
 *
 * VAPID_SUBJECT mora biti validan URL ili mailto: — push provider
 * (Apple, Mozilla, Google) odbija nepravilne subject-e.
 *
 * Bacaš grešku ako env vars nedostaju — bolje fail loud nego silent
 * miss-fire na push send.
 */

let configured = false;

export function getConfiguredWebPush(): typeof webpush {
  if (configured) return webpush;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Missing VAPID env vars (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)",
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return webpush;
}
