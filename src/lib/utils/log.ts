/**
 * Skida PII iz error objekata prije slanja u console.
 * Postgres error-i mogu sadržati telefon/email u `details` polju kroz
 * unique constraint violation poruke. Vercel runtime logovi su retained
 * mjesecima i vidljivi cijelom team-u — ne smije curiti PII tu.
 */

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /[+]?\d[\d\s().\-/]{6,}\d/g;
const TRAILING_QUOTED_RE = /\s+"[^"]*"\s*$/;

export function sanitizeError(err: unknown): {
  code: string | undefined;
  message: string;
} {
  if (err == null) {
    return { code: undefined, message: "unknown error" };
  }

  const obj = err as { code?: unknown; message?: unknown };
  const code = typeof obj.code === "string" ? obj.code : undefined;

  let raw =
    typeof obj.message === "string"
      ? obj.message
      : err instanceof Error
        ? err.message
        : "unknown error";

  raw = raw.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
  raw = raw.replace(TRAILING_QUOTED_RE, "");
  if (raw.length > 80) raw = raw.slice(0, 80);

  return { code, message: raw };
}
