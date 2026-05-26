import { getResendClient } from "./resend";
import {
  renderNewAppointmentEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { buildIcsContent } from "./ics";
import { sanitizeError } from "@/lib/utils/log";

const APPOINTMENT_DURATION_MIN_DEFAULT = 60;

export async function sendNewAppointmentEmail(
  input: NewAppointmentEmailInput,
): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!fromEmail) {
    console.warn("[email skipped] RESEND_FROM_EMAIL missing");
    return;
  }
  if (!adminEmail) {
    console.warn("[email skipped] ADMIN_NOTIFICATION_EMAIL missing");
    return;
  }

  try {
    const { subject, html, text } = renderNewAppointmentEmail(input);

    // ICS attachment — admin može dodati event direktno u svoj kalendar
    const endTime = new Date(
      input.startTime.getTime() + APPOINTMENT_DURATION_MIN_DEFAULT * 60_000,
    );
    const icsContent = buildIcsContent({
      uid: `appt-${input.startTime.getTime()}@upmakeup.ba`,
      start: input.startTime,
      end: endTime,
      summary: `${input.serviceName} — ${input.clientName}`,
      location: "Majora Milana Tepića 13, Gradiška",
      description: `Klijent: ${input.clientName}\nTelefon: ${input.clientPhone}${input.notes ? `\nNapomena: ${input.notes}` : ""}`,
      organizerName: "UP Makeup",
      organizerEmail: fromEmail,
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
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
      console.error("Resend API error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error("sendNewAppointmentEmail unexpected error:", sanitizeError(e));
  }
}
