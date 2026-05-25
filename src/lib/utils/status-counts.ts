/**
 * Tip-safe broojanje appointmenata po statusu. Server izračuna ove
 * brojeve iz već-fetched liste appointmenata (nema dodatnog DB query-ja)
 * i prosljeđuje ih dropdown-u u UI-u.
 */

export const APPOINTMENT_STATUSES = [
  "ceka",
  "potvrdjen",
  "otkazan",
  "zavrsen",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type StatusCounts = Record<AppointmentStatus, number>;

function isAppointmentStatus(s: string): s is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(s);
}

/**
 * Vrati broj appointmenata po statusu. Nevalidni statusi se silently
 * ignore (može se desiti ako baza dobije novi enum koji client kod
 * još ne zna).
 */
export function countByStatus<T extends { status: string }>(
  appointments: T[],
): StatusCounts {
  const counts: StatusCounts = {
    ceka: 0,
    potvrdjen: 0,
    otkazan: 0,
    zavrsen: 0,
  };
  for (const appt of appointments) {
    if (isAppointmentStatus(appt.status)) {
      counts[appt.status]++;
    }
  }
  return counts;
}
