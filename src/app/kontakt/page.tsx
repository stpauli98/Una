import type { Metadata } from "next";
import { MapPin, Phone, Mail, Camera, Music2 } from "lucide-react";
import { Nav } from "@/components/public/Nav";
import { Footer } from "@/components/public/Footer";
import { SectionHeader } from "@/components/public/SectionHeader";
import { BreadcrumbsJsonLd } from "@/components/public/BreadcrumbsJsonLd";
import { BUSINESS } from "@/lib/constants/business";

export const metadata: Metadata = {
  title: "Kontakt",
  description: `Kontakt podaci UP Makeup — ${BUSINESS.address}. Telefon, email, Instagram, TikTok.`,
  alternates: { canonical: "/kontakt" },
  openGraph: { url: "/kontakt" },
};

const CONTACT_CARDS = [
  {
    icon: MapPin,
    label: "Adresa",
    value: BUSINESS.address,
    href: `https://maps.google.com/?q=${encodeURIComponent(BUSINESS.address)}`,
    external: true,
  },
  {
    icon: Phone,
    label: "Telefon",
    value: BUSINESS.phone,
    href: `tel:${BUSINESS.phoneRaw}`,
    external: false,
  },
  {
    icon: Mail,
    label: "Email",
    value: BUSINESS.email,
    href: `mailto:${BUSINESS.email}`,
    external: false,
  },
  {
    icon: Camera,
    label: "Instagram",
    value: BUSINESS.instagramHandle,
    href: BUSINESS.instagram,
    external: true,
  },
  {
    icon: Music2,
    label: "TikTok",
    value: BUSINESS.tiktokHandle,
    href: BUSINESS.tiktok,
    external: true,
  },
] as const;

export default function KontaktPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <>
      <BreadcrumbsJsonLd
        items={[
          { name: "Početna", path: "/" },
          { name: "Kontakt", path: "/kontakt" },
        ]}
        siteUrl={siteUrl}
      />
      <Nav />
      <main className="pt-28">
        <section className="bg-marble px-6 py-16 md:py-24">
          <SectionHeader
            eyebrow="Kontakt"
            title="Stupite u kontakt"
            as="h1"
            className="mb-12"
          />

          <div className="mx-auto grid max-w-[360px] gap-3 md:max-w-[760px] md:grid-cols-2 lg:max-w-[1100px] lg:grid-cols-5">
            {CONTACT_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.label}
                  href={card.href}
                  {...(card.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="group block border border-cream bg-white p-5 transition-colors hover:border-rose"
                >
                  <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-warm text-rose group-hover:bg-rose group-hover:text-white">
                    <Icon size={16} strokeWidth={1.5} />
                  </div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-rose">
                    {card.label}
                  </p>
                  <p className="text-[13px] leading-snug text-dark">
                    {card.value}
                  </p>
                </a>
              );
            })}
          </div>

          <div className="mx-auto mt-16 max-w-[1100px] overflow-hidden rounded-sm border border-cream bg-cream">
            <iframe
              title="UP Makeup na Google Maps"
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d11255.460379226697!2d17.258078!3d45.1493291!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47675f0a0a76d331%3A0x767936a8063a1fe!2sUP%20Makeup!5e0!3m2!1sen!2sba!4v1779481178927!5m2!1sen!2sba"
              width="100%"
              height="380"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block border-0"
              allowFullScreen
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
