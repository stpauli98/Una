"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { submitTrainingInquiry } from "@/app/obuka/actions";

export function TrainingInquiryForm() {
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (success) {
    return (
      <div className="mx-auto max-w-[520px] border border-cream bg-white p-10 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
          <Check size={24} strokeWidth={2} />
        </div>
        <h3 className="mb-3 font-display text-2xl text-dark">
          Hvala na interesovanju!
        </h3>
        <p className="text-sm leading-relaxed text-body">
          Vaš upit je primljen. Una će vas kontaktirati uskoro sa detaljima o
          terminu i programu obuke.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await submitTrainingInquiry(formData);
          if (result.ok) {
            setSuccess(true);
          } else {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
          }
        });
      }}
      className="mx-auto max-w-[520px] border border-cream bg-white p-6 md:p-8"
    >
      <div className="mb-4">
        <label
          htmlFor="name"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Ime i prezime
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
          placeholder="Npr. Ana Jovanović"
        />
        {fieldErrors.name && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="phone"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Telefon
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
          placeholder="065 123 456 ili +49 151 23456789"
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.phone[0]}</p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Email (opciono)
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          disabled={pending}
          className="w-full border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
          placeholder="vas@email.com"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.email[0]}</p>
        )}
      </div>

      <div className="mb-6">
        <label
          htmlFor="message"
          className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-dark"
        >
          Poruka (opciono)
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          disabled={pending}
          className="w-full resize-none border border-cream bg-marble px-3.5 py-2.5 text-sm text-dark placeholder:text-light focus:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose disabled:opacity-60"
          placeholder="Vaše iskustvo, pitanja, željeni termin..."
        />
        {fieldErrors.message && (
          <p className="mt-1 text-xs text-red-600">{fieldErrors.message[0]}</p>
        )}
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-rose py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-rose-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Šaljem..." : "Pošalji upit"}
      </button>
    </form>
  );
}
