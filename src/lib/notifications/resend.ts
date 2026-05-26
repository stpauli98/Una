import { Resend } from "resend";

/**
 * Lazy singleton Resend client.
 *
 * Vraća `null` ako `RESEND_API_KEY` nije setovan (lokalni dev bez Resend
 * account-a). Sve funkcije koje koriste ovo MORAJU graceful-skip-ovati
 * ako je `null` (vidi send-admin-email.ts).
 */
let cachedClient: Resend | null | undefined = undefined;

export function getResendClient(): Resend | null {
  if (cachedClient !== undefined) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/** Testing helper — reset singleton između testova. */
export function _resetResendClientForTests(): void {
  cachedClient = undefined;
}
