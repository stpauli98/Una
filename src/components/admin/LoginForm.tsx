"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = { redirectTo: string };

export function LoginForm({ redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const email = String(fd.get("email"));
        const password = String(fd.get("password"));

        startTransition(async () => {
          const sb = createClient();
          const { error: loginError } = await sb.auth.signInWithPassword({
            email,
            password,
          });
          if (loginError) {
            setError("Neispravan email ili lozinka");
            return;
          }
          router.push(redirectTo);
          router.refresh();
        });
      }}
      className="border border-cream bg-white p-6 md:p-7"
    >
      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
        />
      </div>

      <div className="mb-5">
        <label
          htmlFor="password"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
        />
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rose py-3 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Prijavljujem..." : "Prijavi se"}
      </button>
    </form>
  );
}
