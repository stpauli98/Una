import { getResendClient } from "./resend";
import {
  renderClientConfirmationEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { buildIcsContent } from "./ics";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeError } from "@/lib/utils/log";

/**
 * Šalje confirmation email klijentu pri novoj rezervaciji.
 *
 * Fire-and-log: NIKAD ne throw-uje. Ako Resend nije konfigurisan, ako
 * klijent nije ostavio email, ili ako send fail-uje — samo loguje,
 * appointment kod nas ne fail-uje.
 *
 * Razlika od `sendNewAppointmentEmail` (admin):
 *   - Recipient je `input.clientEmail` umjesto env var-a
 *   - Skip-uje ako `clientEmail === null` (email je opciono polje u
 *     booking formi — neki klijenti daju samo telefon)
 *   - Template je friendly acknowledgment (Vaša rezervacija je primljena)
 *     umjesto action notifikacije
 *
 * Oba dijele isti `.ics` attachment generator. End time dolazi iz
 * `input.endTime` (caller već računa kroz addMinutes(start, service.duration_min))
 * tako da .ics event reflektuje stvarno trajanje (60/120/180 min).
 */
export async function sendClientConfirmationEmail(
  input: NewAppointmentEmailInput,
): Promise<void> {
  if (!input.clientEmail) {
    // Klijent nije ostavio email — skip silently (očekivano, ne loguj).
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn("[client email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[client email skipped] RESEND_FROM_EMAIL missing");
    return;
  }

  try {
    const { subject, html, text } = renderClientConfirmationEmail(input);

    const icsContent = buildIcsContent({
      uid: `appt-${input.startTime.getTime()}@upmakeup.ba`,
      start: input.startTime,
      end: input.endTime,
      summary: `${input.serviceName} — UP Makeup`,
      location: "Majora Milana Tepića 13, Gradiška",
      description: `Termin: ${input.serviceName}. Adresa: Majora Milana Tepića 13, Gradiška. Kontakt: +387 65 810 323.`,
      organizerName: "UP Makeup",
      organizerEmail: fromEmail,
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.clientEmail],
      subject,
      html,
      text,
      attachments: [
        {
          filename: "rezervacija.ics",
          content: Buffer.from(icsContent, "utf-8").toString("base64"),
        },
      ],
    });

    if (result.error) {
      console.error("Resend client email API error:", sanitizeError(result.error));
    }

    if (!result.error) {
      const sb = createAdminClient();
      sb.from("appointments")
        .update({ email_confirmed_sent_at: new Date().toISOString() })
        .eq("id", input.appointmentId)
        .then(null, () => {});
    }
  } catch (e) {
    console.error(
      "sendClientConfirmationEmail unexpected error:",
      sanitizeError(e),
    );
  }
}
