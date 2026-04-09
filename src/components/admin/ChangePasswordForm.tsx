"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/admin/(protected)/postavke/actions";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <form
      action={(fd) => {
        setError(null);
        setSuccess(false);
        const newPass = String(fd.get("new_password") ?? "");
        const confirmPass = String(fd.get("confirm_password") ?? "");
        if (newPass !== confirmPass) {
          setError("Lozinke se ne poklapaju");
          return;
        }
        startTransition(async () => {
          const r = await changePassword(newPass);
          if (r.ok) {
            setSuccess(true);
          } else {
            setError(r.error);
          }
        });
      }}
      className="max-w-sm space-y-3 border border-cream bg-white p-5"
    >
      <div>
        <label
          htmlFor="new_password"
          className="mb-1 block text-[11px] uppercase tracking-wider text-dark"
        >
          Nova lozinka
        </label>
        <input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="confirm_password"
          className="mb-1 block text-[11px] uppercase tracking-wider text-dark"
        >
          Potvrdi lozinku
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full border border-cream bg-marble px-3 py-2 text-sm focus:border-rose focus:outline-none"
        />
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-green-200 bg-green-50 p-2 text-[11px] text-green-700">
          Lozinka je uspješno promijenjena.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rose py-2.5 text-[11px] uppercase tracking-wider text-white hover:bg-rose-hover disabled:opacity-60 cursor-pointer"
      >
        {pending ? "Čuvam..." : "Promijeni lozinku"}
      </button>
    </form>
  );
}
