import { getResendClient } from "./resend";
import {
  renderNewAppointmentEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { sanitizeError } from "@/lib/utils/log";

/**
 * Šalje email Uni o novoj rezervaciji.
 *
 * Fire-and-log: NIKAD ne throw-uje. Ako Resend nije konfigurisan ili
 * pukne, samo loguje — appointment kod koji nas zove ne fail-uje.
 *
 * Provjerava sve potrebne env vars i graceful-skip-uje ako bilo koja
 * nedostaje (npr. lokalni dev bez Resend account-a).
 */
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
    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error("Resend API error:", sanitizeError(result.error));
    }
  } catch (e) {
    console.error("sendNewAppointmentEmail unexpected error:", sanitizeError(e));
  }
}
