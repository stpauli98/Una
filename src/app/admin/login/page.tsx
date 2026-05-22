import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { safeRedirect } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = {
  title: "Prijava — Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const safe = safeRedirect(redirect, "/admin/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-marble px-6 py-16 pt-safe pb-safe">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2">
            <span className="font-display text-3xl font-semibold tracking-[0.15em] text-dark">
              UP
            </span>
            <span className="text-[9px] uppercase leading-tight tracking-[0.2em] text-light">
              Makeup
            </span>
          </div>
          <h1 className="font-display text-2xl font-light text-dark">
            Admin panel
          </h1>
          <p className="mt-1 text-[12px] text-light">Prijavite se za nastavak</p>
        </div>
        <LoginForm redirectTo={safe} />
      </div>
    </main>
  );
}
