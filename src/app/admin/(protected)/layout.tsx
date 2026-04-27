import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/admin-emails";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Layout za sve zaštićene admin rute. Koristi route group `(protected)`
 * tako da `/admin/login` ne nasljeđuje shell niti auth provjeru.
 *
 * Defense-in-depth: proxy (src/proxy.ts) je prva linija odbrane, ali ako
 * ikad bude bypass-ovan (npr. nova ruta zaboravi matcher) layout sam
 * provjerava i `user` i admin email. NE koristi requireAdmin() ovdje —
 * ono baca grešku, a u layout-u treba `redirect()`.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/admin/login");
  }

  return <AdminShell userEmail={user.email ?? null}>{children}</AdminShell>;
}
