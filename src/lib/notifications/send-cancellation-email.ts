import { getResendClient } from "./resend";
import {
  renderBookingNotConfirmedEmail,
  renderBookingCancelledEmail,
  type NewAppointmentEmailInput,
} from "./templates";
import { buildIcsContent } from "./ics";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeError } from "@/lib/utils/log";

export type CancellationEmailInput = NewAppointmentEmailInput & {
  previousStatus: "ceka" | "potvrdjen";
};

export async function sendCancellationEmail(
  input: CancellationEmailInput,
): Promise<void> {
  if (!input.clientEmail) return;

  const resend = getResendClient();
  if (!resend) {
    console.warn("[cancellation email skipped] RESEND_API_KEY missing");
    return;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn("[cancellation email skipped] RESEND_FROM_EMAIL missing");
    return;
  }

  try {
    const wasPreviouslyConfirmed = input.previousStatus === "potvrdjen";

    const { subject, html, text } = wasPreviouslyConfirmed
      ? renderBookingCancelledEmail(input)
      : renderBookingNotConfirmedEmail(input);

    const attachments: Array<{ filename: string; content: string }> = [];

    if (wasPreviouslyConfirmed) {
      const icsContent = buildIcsContent({
        uid: `appt-${input.startTime.getTime()}@upmakeup.ba`,
        start: input.startTime,
        end: input.endTime,
        summary: `${input.serviceName} — UP Makeup`,
        location: "Majora Milana Tepića 13, Gradiška",
        description: `OTKAZANO: ${input.serviceName}`,
        method: "CANCEL",
        status: "CANCELLED",
      });
      attachments.push({
        filename: "otkazano.ics",
        content: Buffer.from(icsContent, "utf-8").toString("base64"),
      });
    }

    const result = await resend.emails.send({
      from: fromEmail,
      to: [input.clientEmail],
      subject,
      html,
      text,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    if (result.error) {
      console.error("Resend cancellation error:", sanitizeError(result.error));
    }

    if (!result.error) {
      const sb = createAdminClient();
      sb
        .from("appointments")
        .update({ email_cancelled_sent_at: new Date().toISOString() })
        .eq("id", input.appointmentId)
        .then(null, () => {});
    }
  } catch (e) {
    console.error("sendCancellationEmail error:", sanitizeError(e));
  }
}
