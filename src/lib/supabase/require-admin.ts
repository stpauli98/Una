"use server";

import { createClient } from "./server";

/** Dozvoljeni admin email-ovi. */
const ADMIN_EMAILS = new Set([
  "peranovicuna6@gmail.com",
  "test@admin.com", // E2E test user
]);

/**
 * Provjerava da je korisnik autentificiran I da je admin (po email-u).
 * Baca gresku ako nije — koristi u svim admin server action-ima.
 */
export async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    throw new Error("Nije autorizovan");
  }
  if (!ADMIN_EMAILS.has(user.email ?? "")) {
    throw new Error("Nemate admin pristup");
  }

  return sb;
}
