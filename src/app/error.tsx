"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-marble px-6">
      <div className="py-20 text-center">
        <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-rose">
          Greška
        </p>
        <h1 className="mb-4 font-display text-4xl font-light text-dark md:text-5xl">
          Nešto je pošlo po zlu
        </h1>
        <p className="mb-8 text-[14px] text-body">
          Došlo je do neočekivane greške. Pokušajte ponovo.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-block bg-rose px-8 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover cursor-pointer"
        >
          Pokušaj ponovo
        </button>
      </div>
    </div>
  );
}
