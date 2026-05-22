/**
 * Poslovne konstante — kontakt informacije i booking pravila.
 * Izvor istine za ime, adresu, telefon, radno vrijeme i pravila rezervacije.
 */
export const BUSINESS = {
  name: "UP Beauty & Makeup Studio",
  owner: "Una Peranović",
  address: "Majora Milana Tepića 13, Gradiška",
  phone: "+387 65 810 323",
  phoneRaw: "38765810323",
  email: "peranovicuna6@gmail.com",
  instagram: "https://instagram.com/_upmakeup._",
  tiktok: "https://tiktok.com/@upmakeup21",
  instagramHandle: "@_upmakeup._",
  tiktokHandle: "@upmakeup21",
  geo: { lat: 45.1493291, lng: 17.258078 },
  googleMapsCid: "533147015268556799",
  googleMapsShareUrl: "https://share.google/PMvWaQNdzmDPKs5qg",
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
