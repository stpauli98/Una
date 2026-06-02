import { cn } from "@/lib/utils/cn";

type Props = {
  eyebrow: string;
  title: string;
  /** Ako true, koristi tamnu/cream paletu za hero-over sekcije. */
  light?: boolean;
  className?: string;
  /** Semantički nivo naslova (vizuelno identično). Default h2. */
  as?: "h1" | "h2";
};

/**
 * Zajednički header za javne sekcije:
 *   · italic eyebrow caption u rose boji
 *   · veliki Cormorant naslov
 *   · zlatni razdjelnik ispod
 */
export function SectionHeader({
  eyebrow,
  title,
  light,
  className,
  as: Heading = "h2",
}: Props) {
  return (
    <div className={cn("text-center", className)}>
      <p
        className={cn(
          "mb-2 font-display text-xs italic uppercase tracking-[0.3em]",
          light ? "text-gold-light" : "text-rose",
        )}
      >
        {eyebrow}
      </p>
      <Heading
        className={cn(
          "font-display text-[clamp(30px,4.5vw,42px)] font-light tracking-wide",
          light ? "text-marble" : "text-dark",
        )}
      >
        {title}
      </Heading>
      <div
        className={cn(
          "mx-auto mt-3.5 h-px w-12",
          light ? "bg-gold-light" : "bg-gold",
        )}
      />
    </div>
  );
}
