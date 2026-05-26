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
  /** End time — proslijedi izračunato sa addMinutes(start, service.duration_min)
   *  iz caller-a. Koristi se za .ics calendar attachment dueTo da bi event
   *  reflektovao stvarno trajanje usluge (60/120/180 min), ne fixed 60min. */
  endTime: Date;
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

/**
 * Render-uje confirmation email NAMIJENJEN KLIJENTU — drugačiji ton od
 * admin notifikacije ("Vaša rezervacija je primljena" umjesto "Nova
 * rezervacija stigla"). Spec: friendly acknowledgment + datum/vrijeme
 * + adresa za dolazak + kontakt za otkazivanje + napomena o .ics
 * attachment-u.
 */
export function renderClientConfirmationEmail(
  input: NewAppointmentEmailInput,
): RenderedEmail {
  const dateStr = formatDateSr(input.startTime);
  const timeStr = formatInTimeZone(input.startTime, TZ, "HH:mm");

  const subject = `Vaša rezervacija — ${input.serviceName}, ${dateStr} u ${timeStr}`;

  const html = `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#2A2A2A;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#C4787A;margin:0 0 8px 0;">UP MAKEUP</h1>
  <h2 style="font-size:24px;font-weight:400;color:#2A2A2A;margin:0 0 24px 0;">Vaša rezervacija je primljena</h2>

  <p style="font-size:15px;line-height:1.6;margin:0 0 16px 0;">Hvala vam, <strong>${escapeHtml(input.clientName)}</strong>. Una će potvrditi vašu rezervaciju u najkraćem roku.</p>

  <div style="background:#fff;border:1px solid #EDE7DF;padding:20px;margin:24px 0;">
    <p style="margin:0 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8A8580;">Termin</p>
    <p style="margin:0 0 4px 0;font-size:18px;font-weight:500;">${escapeHtml(input.serviceName)}</p>
    <p style="margin:0 0 4px 0;font-size:15px;">${dateStr}</p>
    <p style="margin:0 0 16px 0;font-size:15px;">${timeStr}</p>

    <p style="margin:16px 0 8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#8A8580;">Adresa</p>
    <p style="margin:0;font-size:14px;">Majora Milana Tepića 13, Gradiška</p>
  </div>

  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 16px 0;">📅 U prilogu je <code style="background:#EDE7DF;padding:2px 6px;font-size:12px;">.ics</code> fajl — otvorite ga na telefonu/računaru da dodate termin u svoj kalendar.</p>

  <p style="font-size:13px;line-height:1.6;color:#5A5550;margin:0 0 32px 0;">Ako trebate otkazati ili pomjeriti, javite na <a href="tel:+38765810323" style="color:#C4787A;text-decoration:none;">+387 65 810 323</a>.</p>

  <hr style="border:none;border-top:1px solid #EDE7DF;margin:24px 0;">
  <p style="font-size:11px;color:#8A8580;text-align:center;margin:0;">UP Makeup · Majora Milana Tepića 13, Gradiška</p>
</div>
</body>
</html>`;

  const text = `UP MAKEUP — Vaša rezervacija je primljena

Hvala vam, ${input.clientName}. Una će potvrditi vašu rezervaciju u najkraćem roku.

TERMIN
${input.serviceName}
${dateStr}
${timeStr}

ADRESA
Majora Milana Tepića 13, Gradiška

U prilogu je .ics fajl — otvorite ga da dodate termin u svoj kalendar.

Ako trebate otkazati ili pomjeriti, javite na +387 65 810 323.

UP Makeup`;

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
