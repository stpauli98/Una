"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!(await checkRateLimit(ip, 5, 300_000, { failClosed: true }))) {
    return { ok: false, error: "Previše pokušaja. Pokušajte za 5 minuta." };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email i lozinka su obavezni" };
  }

  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: "Pogrešan email ili lozinka" };
  }

  return { ok: true };
}
