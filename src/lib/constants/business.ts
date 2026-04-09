/**
 * Poslovne konstante — kontakt informacije i booking pravila.
 * Izvor istine za ime, adresu, telefon, radno vrijeme i pravila rezervacije.
 */
export const BUSINESS = {
  name: "UP Beauty & Makeup Studio",
  owner: "Una Peranović",
  address: "Vidovdanska 89 / stan 25, Gradiška",
  phone: "+387 65 810 323",
  phoneRaw: "38765810323",
  email: "peranovicuna6@gmail.com",
  instagram: "https://instagram.com/_upmakeup._",
  tiktok: "https://tiktok.com/@upmakeup21",
  instagramHandle: "@_upmakeup._",
  tiktokHandle: "@upmakeup21",
  geo: { lat: 45.1441, lng: 17.2514 },
  timezone: "Europe/Sarajevo",
} as const;

export const BOOKING_RULES = {
  weekday: { open: "17:00", close: "21:00", days: [1, 2, 3, 4, 5] as const },
  weekend: { open: "05:00", close: "21:00", days: [0, 6] as const },
  advance_booking_days: 90,
  min_hours_before: 24,
  cancellation_hours: 24,
  break_between_min: 0,
} as const;

export type BookingRules = typeof BOOKING_RULES;
