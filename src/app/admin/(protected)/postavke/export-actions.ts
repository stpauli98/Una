"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { CSV_BOM, buildCsvRow } from "@/lib/utils/csv";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import { atSarajevo } from "@/lib/utils/tz";

export type ExportResult =
  | { ok: true; csv: string; filename: string; rowCount: number }
  | { ok: false; error: string };

const STATUS_LABELS: Record<string, string> = {
  ceka: "Čeka",
  potvrdjen: "Potvrđen",
  otkazan: "Otkazan",
  zavrsen: "Završen",
};

/**
 * Generiše CSV export svih termina, opciono filtriran po godini (u Sarajevo TZ).
 *
 * Format: UTF-8 sa BOM, semicolon separator (Excel EU lokalni).
 * Datum/vrijeme uvijek u Sarajevo TZ — tačno onako kako Una vidi u UI.
 *
 * Kolone:
 *   ID, Datum, Vrijeme, Trajanje (min), Klijent, Telefon, Email, Usluga,
 *   Status, Cijena (KM), Napomene, Rezervisano
 *
 * `year=null` → svi termini ever (backup use case).
 * `year=2026` → samo termini čiji start_time pada u kalendarskoj 2026.
 *               u Sarajevo TZ (porezni izvještaj use case).
 */
export async function exportAppointmentsCsv(
  year: number | null,
): Promise<ExportResult> {
  try {
    const sb = await requireAdmin();

    let query = sb
      .from("appointments")
      .select(
        "id,client_name,client_phone,client_email,start_time,end_time,status,notes,price_snapshot,created_at,services(name)",
      )
      .order("start_time", { ascending: true });

    if (year !== null) {
      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        return { ok: false, error: "Neispravna godina" };
      }
      // Sarajevo midnight start/end — atSarajevo vraća UTC instant
      // za wall-clock 00:00 1. januara u toj TZ.
      const start = atSarajevo(year, 1, 1, 0, 0).toISOString();
      const end = atSarajevo(year + 1, 1, 1, 0, 0).toISOString();
      query = query.gte("start_time", start).lt("start_time", end);
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };

    const rows = data ?? [];

    const header = buildCsvRow([
      "ID",
      "Datum",
      "Vrijeme",
      "Trajanje (min)",
      "Klijent",
      "Telefon",
      "Email",
      "Usluga",
      "Status",
      "Cijena (KM)",
      "Napomene",
      "Rezervisano",
    ]);

    const lines = rows.map((r) => {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      const durationMin = Math.round(
        (end.getTime() - start.getTime()) / 60_000,
      );
      const created = new Date(r.created_at);
      return buildCsvRow([
        r.id,
        formatShortDate(start),
        formatTime(start),
        durationMin,
        r.client_name,
        r.client_phone,
        r.client_email,
        r.services?.name ?? "",
        STATUS_LABELS[r.status] ?? r.status,
        r.price_snapshot,
        r.notes,
        `${formatShortDate(created)} ${formatTime(created)}`,
      ]);
    });

    const csv = CSV_BOM + [header, ...lines].join("\r\n");
    const filename = year === null ? "termini-svi.csv" : `termini-${year}.csv`;

    return { ok: true, csv, filename, rowCount: rows.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Export failed",
    };
  }
}
