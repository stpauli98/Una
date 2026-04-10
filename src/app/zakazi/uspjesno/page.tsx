import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageCircle, Phone, Camera } from "lucide-react";
import { Nav } from "@/components/public/Nav";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/utils/format";
import { BUSINESS } from "@/lib/constants/business";
import { waLink } from "@/lib/utils/wa";

export const metadata: Metadata = {
  title: "Termin primljen",
  description: "Vaš termin je uspješno primljen.",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ id?: string }>;
};

export default async function UspjesnoPage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  if (!id) notFound();

  const sb = createAdminClient();
  const { data: appointment } = await sb
    .from("appointments")
    .select(
      "id,start_time,client_name,service_id,services(name,price,price_note)",
    )
    .eq("id", Number(id))
    .maybeSingle();

  if (!appointment) notFound();

  const startDate = new Date(appointment.start_time);
  const serviceName = appointment.services?.name ?? "vaša usluga";
  const waMessage = `Zdravo Una, upravo sam rezervisao/la termin za ${serviceName} u ${formatDate(startDate)} u ${formatTime(startDate)}. Ime: ${appointment.client_name}.`;

  return (
    <>
      <Nav />
      <main className="pt-28">
        <section className="bg-warm px-6 py-16 md:py-24">
          <div className="mx-auto max-w-[580px] text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-rose/10 text-rose">
              <Check size={28} strokeWidth={2} />
            </div>

            <h1 className="mb-3 font-display text-4xl font-light text-dark md:text-5xl">
              Termin primljen
            </h1>
            <p className="mb-8 text-[14px] leading-relaxed text-body">
              Hvala vam! Vaš termin je zabilježen. Una će vas uskoro
              kontaktirati putem WhatsApp-a da potvrdi rezervaciju.
            </p>

            <div className="mb-8 border border-cream bg-white p-6 text-left">
              <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-rose">
                Vaša rezervacija
              </p>
              <p className="font-display text-2xl text-dark">{serviceName}</p>
              <p className="mt-2 text-sm text-body">
                {formatDate(startDate)} · {formatTime(startDate)}
              </p>
              <p className="mt-1 text-[12px] text-light">
                Na ime: {appointment.client_name}
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={waLink(BUSINESS.phoneRaw, waMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 bg-green-600 py-3.5 text-[11px] uppercase tracking-[0.25em] text-white transition-colors hover:bg-green-700"
              >
                <MessageCircle size={14} />
                Pošaljite poruku Uni
              </a>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`tel:${BUSINESS.phoneRaw}`}
                  className="flex items-center justify-center gap-2 border border-cream bg-white py-3 text-[11px] uppercase tracking-[0.2em] text-dark transition-colors hover:border-rose hover:text-rose"
                >
                  <Phone size={12} /> Pozovi
                </a>
                <a
                  href={BUSINESS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-cream bg-white py-3 text-[11px] uppercase tracking-[0.2em] text-dark transition-colors hover:border-rose hover:text-rose"
                >
                  <Camera size={12} /> Instagram
                </a>
              </div>
            </div>

            <div className="mt-10 text-[12px] text-light">
              <p>{BUSINESS.address}</p>
              <p className="mt-1">
                Rezervacija postaje obavezujuća nakon Unine potvrde.
              </p>
            </div>

            <div className="mt-8">
              <Link
                href="/"
                className="text-[11px] uppercase tracking-[0.2em] text-rose underline-offset-4 hover:underline"
              >
                Nazad na početnu
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
