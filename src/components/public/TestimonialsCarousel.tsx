"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const TESTIMONIALS = [
  {
    name: "Stela P.",
    text: "Una je pravi umjetnik! Njen pristup je osvježavajući, naglašava prirodnu ljepotu na način koji me uvijek ostavi bez daha.",
  },
  {
    name: "Marija Đ.",
    text: "Jedna od rijetkih na čiju stolicu sjednem i prepustim se skroz. Njena vještina je nešto što svaka žena treba da iskoristi.",
  },
  {
    name: "Dajana G.",
    text: "Nikada se nisam osjećala toliko sigurno u svojoj koži kao kad izađem iz njenog studija.",
  },
] as const;

export function TestimonialsCarousel() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setActiveIdx((prev) => (prev + 1) % TESTIMONIALS.length),
      4500,
    );
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mx-auto min-h-[220px] max-w-[600px] text-center">
      {TESTIMONIALS.map((testimonial, i) => (
        <div
          key={testimonial.name}
          className={cn(
            "px-5 transition-all duration-700",
            i === activeIdx
              ? "relative opacity-100 translate-y-0"
              : "pointer-events-none absolute inset-x-0 top-0 opacity-0 translate-y-2",
          )}
          aria-hidden={i !== activeIdx}
        >
          <div className="mb-3 font-display text-[36px] text-gold-light/40">
            &ldquo;
          </div>
          <p className="mb-5 font-display text-[clamp(16px,2.4vw,22px)] font-light italic leading-relaxed text-white/80">
            {testimonial.text}
          </p>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light">
            {testimonial.name}
          </p>
        </div>
      ))}

      <div className="mt-6 flex justify-center gap-2">
        {TESTIMONIALS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setActiveIdx(i)}
            aria-label={`Prikaži utisak ${i + 1}`}
            className={cn(
              "h-2 rounded-full transition-all duration-400",
              i === activeIdx ? "w-7 bg-gold-light" : "w-2 bg-white/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}
