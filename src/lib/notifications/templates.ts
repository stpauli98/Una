import { formatInTimeZone } from "date-fns-tz";

/**
 * Input za rendere email-a "Nova rezervacija".
 */
export type NewAppointmentEmailInput = {
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  serviceName: string;
  startTime: Date;
  notes: string | null;
  adminPanelUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const TZ = "Europe/Sarajevo";

// Domaći nazivi mjeseci za "Pet, 15. maj 2026."
const MONTHS = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
] as const;
const DAYS_SHORT = ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"] as const;

function formatDateSr(date: Date): string {
  // "Pet, 15. maj 2026." — sve komponente uzimamo direktno iz Sarajevo TZ
  // da bismo izbjegli ovisnost o lokalnoj TZ runtime-a.
  const yearStr = formatInTimeZone(date, TZ, "yyyy");
  const monthStr = formatInTimeZone(date, TZ, "MM");
  const dayStr = formatInTimeZone(date, TZ, "dd");
  const dowStr = formatInTimeZone(date, TZ, "i"); // 1=Mon .. 7=Sun (ISO)

  const year = Number(yearStr);
  const month = Number(monthStr); // 1-12
  const day = Number(dayStr);
  const isoDow = Number(dowStr); // 1..7 (Mon..Sun)
  // Mapiraj ISO (Mon=1..Sun=7) na našu DAYS_SHORT (Ned=0..Sub=6 = Sun..Sat).
  const dayOfWeekIdx = isoDow === 7 ? 0 : isoDow; // 1..6 = Pon..Sub, 0 = Ned

  return `${DAYS_SHORT[dayOfWeekIdx]}, ${day}. ${MONTHS[month - 1]} ${year}.`;
}

function formatTimeSr(date: Date): string {
  return formatInTimeZone(date, TZ, "HH:mm");
}

export function renderNewAppointmentEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const { clientName, clientPhone, clientEmail, serviceName, startTime, notes, adminPanelUrl } = input;
  const dateLabel = formatDateSr(startTime);
  const timeLabel = formatTimeSr(startTime);

  const subject = `Nova rezervacija: ${clientName} — ${serviceName} (${dateLabel})`;

  const html = `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#fdfbf9;font-family:Georgia,'Times New Roman',serif;color:#5a4545;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fdfbf9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px;background:#ffffff;border:1px solid #f0e6dd;">
        <tr><td style="padding:32px 32px 16px 32px;border-bottom:1px solid #f0e6dd;">
          <div style="font-size:14px;letter-spacing:0.25em;text-transform:uppercase;color:#b8965a;font-weight:600;">UP Makeup</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px 0;font-size:28px;font-style:italic;font-weight:normal;color:#3d2b2b;">Nova rezervacija</h1>
          <div style="width:48px;height:2px;background:#c4787a;margin-bottom:24px;"></div>

          <h2 style="margin:24px 0 8px 0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#887070;font-weight:600;">Klijent</h2>
          <div style="font-size:16px;color:#3d2b2b;margin-bottom:4px;">${escapeHtml(clientName)}</div>
          <div style="font-size:14px;"><a href="tel:${escapeHtmlAttr(clientPhone)}" style="color:#c4787a;text-decoration:none;">${escapeHtml(clientPhone)}</a></div>
          ${clientEmail ? `<div style="font-size:14px;margin-top:4px;"><a href="mailto:${escapeHtmlAttr(clientEmail)}" style="color:#c4787a;text-decoration:none;">${escapeHtml(clientEmail)}</a></div>` : ""}

          <h2 style="margin:32px 0 8px 0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#887070;font-weight:600;">Termin</h2>
          <div style="font-size:16px;color:#3d2b2b;margin-bottom:4px;">${escapeHtml(serviceName)}</div>
          <div style="font-size:14px;color:#5a4545;">${escapeHtml(dateLabel)}</div>
          <div style="font-size:14px;color:#5a4545;">${escapeHtml(timeLabel)}</div>

          ${notes ? `<h2 style="margin:32px 0 8px 0;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;color:#887070;font-weight:600;">Napomena</h2><div style="font-size:14px;font-style:italic;color:#5a4545;">"${escapeHtml(notes)}"</div>` : ""}

          <div style="margin-top:40px;">
            <a href="${adminPanelUrl}" style="display:inline-block;background:#b8965a;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;">Otvori u admin panelu</a>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #f0e6dd;font-size:12px;color:#887070;">
          UP Makeup Studio<br>
          Majora Milana Tepića 13, Gradiška
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `NOVA REZERVACIJA — UP Makeup

Klijent: ${clientName}
Telefon: ${clientPhone}${clientEmail ? `\nEmail: ${clientEmail}` : ""}

Termin: ${serviceName}
Datum: ${dateLabel}
Vrijeme: ${timeLabel}
${notes ? `\nNapomena: ${notes}\n` : ""}
Otvori u admin panelu:
${adminPanelUrl}

--
UP Makeup Studio
Majora Milana Tepića 13, Gradiška
`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Minimal attribute-context escape — samo `"`, `'`, `<`, `>` da spreči
 * attribute injection. NE koristi `encodeURIComponent` jer kvari `+`
 * u tel: (postaje %2B i neki dialer-i biraju "2B" literalno) i
 * `+` u mailto: aliasima (user+tag@gmail.com).
 *
 * Phone je već normalizovan (normalizePhone), email je Zod-validovan
 * — pa su attack chars praktično nemogući, ali defense-in-depth.
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
