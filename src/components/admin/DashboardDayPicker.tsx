"use client";

import { AdminDayPicker } from "./AdminDayPicker";

type Props = {
  /** Trenutno izabrani datum kao YYYY-MM-DD (Sarajevo TZ). */
  selectedDateStr: string;
  /** Današnji dan kao YYYY-MM-DD. */
  todayDateStr: string;
  /** Maksimalan datum unaprijed (YYYY-MM-DD), inkluzivno. */
  maxDateStr: string;
};

/**
 * Dashboard day picker. Thin wrapper oko AdminDayPicker — drži postojeći
 * import path stabilan a logika dijeljena sa Termini stranicom.
 */
export function DashboardDayPicker(props: Props) {
  return <AdminDayPicker {...props} basePath="/admin/dashboard" />;
}
