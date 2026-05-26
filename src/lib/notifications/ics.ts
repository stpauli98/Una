/**
 * iCalendar (.ics) VEVENT builder, RFC 5545 compliant.
 *
 * Generiše standalone VCALENDAR string koji email klijenti (Gmail,
 * Apple Mail, Outlook) prepoznaju kao calendar event attachment —
 * automatski prikazuju "Add to Calendar" CTA bez ručne integracije.
 *
 * Vremena se serijalizuju u UTC sa `Z` suffix-om (npr.
 * `20260528T160000Z`). Calendar aplikacije konvertuju u user-local
 * TZ pri renderu. Alternativa (VTIMEZONE blok sa DST tranzicijama)
 * dvostruko poveća payload i komplikuje testabilnost; UTC pristup
 * je univerzalno podržan.
 */

export type IcsInput = {
  /** Globalno jedinstven UID za event (npr. `appt-<id>@upmakeup.ba`). */
  uid: string;
  /** Start time (UTC instant — Date objekat). */
  start: Date;
  /** End time (UTC instant — mora biti > start). */
  end: Date;
  /** Naslov event-a koji se prikazuje u kalendar UI-ju. */
  summary: string;
  /** Lokacija (adresa). Escape je interni — proslijedi nepromijenjeno. */
  location: string;
  /** Opis event-a (clientName, kontakt). */
  description: string;
  /** Opciono — organizer ime (CN polje). */
  organizerName?: string;
  /** Opciono — organizer email (mailto: target). */
  organizerEmail?: string;
  /** ICS method — REQUEST za novi event, CANCEL za brisanje. Default: REQUEST. */
  method?: "REQUEST" | "CANCEL";
  /** ICS event status. Default: CONFIRMED. */
  status?: "CONFIRMED" | "CANCELLED";
};

/**
 * RFC 5545 zahtjeva escape sljedećih karaktera u TEXT polju:
 *   - backslash `\` → `\\`
 *   - zarez `,` → `\,`
 *   - semicolon `;` → `\;`
 *   - newline (LF/CRLF) → `\n` (literal sa lowercase n)
 *
 * NE escape-uju se: navodnici, quote characters, apostrofi.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** YYYYMMDDTHHMMSSZ format iz Date objekta (UTC). */
function formatIcsUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

export function buildIcsContent(input: IcsInput): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//UP Makeup//Booking//SR");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`METHOD:${input.method ?? "REQUEST"}`);
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${input.uid}`);
  lines.push(`DTSTAMP:${formatIcsUtc(new Date())}`);
  lines.push(`DTSTART:${formatIcsUtc(input.start)}`);
  lines.push(`DTEND:${formatIcsUtc(input.end)}`);
  lines.push(`SUMMARY:${escapeIcsText(input.summary)}`);
  lines.push(`LOCATION:${escapeIcsText(input.location)}`);
  lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`);
  if (input.organizerName && input.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${input.organizerName}:mailto:${input.organizerEmail}`,
    );
  }
  lines.push(`STATUS:${input.status ?? "CONFIRMED"}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
