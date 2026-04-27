/**
 * Single source of truth za listu admin email-ova.
 * Importovati iz src/proxy.ts i src/lib/supabase/require-admin.ts.
 *
 * Test admin (test@admin.com) NIJE u prod bundle-u — dodaje se samo
 * kroz ADMIN_EMAILS_EXTRA env var u .env.test (postavlja test:setup skripta).
 */
const baseAdmins = ["peranovicuna6@gmail.com"] as const;

const extras = (process.env.ADMIN_EMAILS_EXTRA ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const ADMIN_EMAILS = new Set<string>([
  ...baseAdmins.map((s) => s.toLowerCase()),
  ...extras,
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
