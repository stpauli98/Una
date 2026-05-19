import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/utils/tz";

export type DateGroup<T> = {
  /** Sarajevo datum kao YYYY-MM-DD */
  dateStr: string;
  appointments: T[];
};

/**
 * Grupira appointmente po Sarajevo kalendaru. Input redoslijed se ČUVA
 * unutar svake grupe i pri redoslijedu grupa — funkcija ne sortira ništa,
 * samo razdvaja u sukcesivne grupe pri promjeni datuma.
 *
 * To znači:
 *   - DB query već vraća redove u željenom redoslijedu (ASC ili DESC)
 *   - Ova funkcija samo razdvaja u grupe za UI render headere
 *   - Ako input nije monotono sortiran po datumu, funkcija će napraviti
 *     više grupa za isti datum (dvaput dateStr "2026-05-19" itd.) — to
 *     je intencionalno; caller je odgovoran za sortiranje prije poziva
 */
export function groupAppointmentsByDay<T extends { start_time: string }>(
  appointments: T[],
): DateGroup<T>[] {
  const groups: DateGroup<T>[] = [];
  let currentGroup: DateGroup<T> | null = null;

  for (const appt of appointments) {
    const dateStr = formatInTimeZone(
      new Date(appt.start_time),
      TZ,
      "yyyy-MM-dd",
    );
    if (!currentGroup || currentGroup.dateStr !== dateStr) {
      currentGroup = { dateStr, appointments: [] };
      groups.push(currentGroup);
    }
    currentGroup.appointments.push(appt);
  }

  return groups;
}
