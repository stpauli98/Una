import { getResendClient } from "./resend";
import {
  renderBookingReceivedEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeError } from "@/lib/utils/log";

export async function sendBookingReceivedEmail(
  input: NewAppointmentEmailInput,
): Promise<void> {
  if (!input.clientEmail) return;

  const resend = getResendClient();
  if (!resend) {
    console.warn("[booking-received email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[booking-received email skipped] RESEND_FROM_EMAIL missing");
    return;
  }

  try {
    const { subject, html, text } = renderBookingReceivedEmail(input);
    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.clientEmail],
      subject,
      html,
      text,
    });
    if (result.error) {
      console.error("Resend booking-received error:", sanitizeError(result.error));
    }

    if (!result.error) {
      const sb = createAdminClient();
      sb
        .from("appointments")
        .update({ email_received_sent_at: new Date().toISOString() })
        .eq("id", input.appointmentId)
        .then(null, () => {});
    }
  } catch (e) {
    console.error("sendBookingReceivedEmail error:", sanitizeError(e));
  }
}
