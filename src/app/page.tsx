import { BUSINESS } from "@/lib/constants/business";

/**
 * Privremeni placeholder za početnu stranicu. Zamjenjuje se u Phase 5
 * pravim hero + sekcijama prema dizajnu iz `up-makeup-preview.jsx`.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-gold">
          Beauty Studio · Gradiška
        </p>
        <h1 className="mb-6 font-display text-5xl font-light text-dark">
          {BUSINESS.name}
        </h1>
        <p className="text-sm leading-relaxed text-body">
          Sajt je u izradi. Uskoro će biti dostupan sistem za online
          zakazivanje termina.
        </p>
      </div>
    </main>
  );
}
