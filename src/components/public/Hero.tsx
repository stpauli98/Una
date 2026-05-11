import { HeroMinimalist } from "./HeroMinimalist";

/**
 * Hero sekcija — trenutno renderuje HeroMinimalist (varijanta B).
 *
 * Alternativna A varijanta (scroll-driven bento gallery) je dostupna na
 * branch-u `feature/animated-hero` / PR #13. Korisnica procjenjuje obje
 * varijante i bira koju mergeuje u main.
 */
export function Hero() {
  return <HeroMinimalist />;
}
