import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Layout za sve zaštićene admin rute. Koristi route group `(protected)`
 * tako da `/admin/login` ne nasljeđuje shell niti auth provjeru.
 * Proxy (src/proxy.ts) je prva linija odbrane; ovo je defensivni fallback.
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

  if (!user) {
    redirect("/admin/login");
  }

  return <AdminShell userEmail={user.email ?? null}>{children}</AdminShell>;
}
