"use server";

import { createClient } from "./server";
import { isAdminEmail } from "@/lib/auth/admin-emails";

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
  if (!isAdminEmail(user.email)) {
    throw new Error("Nemate admin pristup");
  }

  return sb;
}
