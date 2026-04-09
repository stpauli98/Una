/**
 * Domen tipovi za booking engine. Čisto TS — bez Supabase zavisnosti —
 * da se `computeAvailableSlots` može testirati izolovano.
 */

/** Jedan raspoloživ slot na kalendaru. */
export type Slot = {
  start: Date;
  end: Date;
};

/** Radno vrijeme za jedan dan u sedmici. */
export type DailyHours = {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
  isOpen: boolean;
};

/** Postojeći termin koji zauzima vremenski raspon. */
export type ExistingAppointment = {
  start: Date;
  end: Date;
};

/** Blokirani raspon datuma (godišnji, praznik, privatno). */
export type BlockedRange = {
  from: Date; // inclusive, start of day
  to: Date; // inclusive, start of day
};
