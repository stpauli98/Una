"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { getResendClient } from "@/lib/notifications/resend";
import { renderNewAppointmentEmail } from "@/lib/notifications/templates";
import { normalizeSiteUrl } from "@/lib/utils/site-url";

export type EmailTestResult =
  | { ok: true; recipientEmail: string }
  | { ok: false; error: string };

/**
 * Šalje TEST email koji koristi isti `renderNewAppointmentEmail` template
 * kao real booking flow (sa `[TEST]` subject prefix-om za jasnoću), na
 * ADMIN_NOTIFICATION_EMAIL.
 *
 * Korišćeno preko "Pošalji test" dugmeta u Postavke → Email obavještenja,
 * tako da admin može da potvrdi end-to-end Resend setup (API key, FROM
 * email, DNS records, recipient inbox) bez čekanja na real rezervaciju.
 *
 * Sve tri env vars MORAJU biti setovane na produkciji — bez toga vraća
 * jasnu error poruku umjesto silent skip-a (za razliku od fire-and-log
 * pattern-a u send-admin-email.ts).
 */
export async function sendTestAdminEmail(): Promise<EmailTestResult> {
  try {
    await requireAdmin();

    const resend = getResendClient();
    if (!resend) {
      return {
        ok: false,
        error:
          "RESEND_API_KEY nije setovan u env. Postavi u Vercel Project Settings → Environment Variables, pa redeploy.",
      };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL;
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    if (!fromEmail) {
      return { ok: false, error: "RESEND_FROM_EMAIL nije setovan u env." };
    }
    if (!adminEmail) {
      return {
        ok: false,
        error: "ADMIN_NOTIFICATION_EMAIL nije setovan u env.",
      };
    }

    // Dummy podaci — koristi isti template kao real rezervacija da admin
    // vidi tačno kako će email izgledati za prave rezervacije.
    const testStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const testEnd = new Date(testStart.getTime() + 60 * 60_000);
    const { subject, html, text } = renderNewAppointmentEmail({
      clientName: "Test Klijent",
      clientPhone: "+387 65 000 000",
      clientEmail: null,
      serviceName: "Šminkanje",
      startTime: testStart,
      endTime: testEnd,
      notes:
        "Ovo je TEST email iz admin panela — nije prava rezervacija. Možete ignorisati.",
      adminPanelUrl: `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`,
      appointmentId: 0,
    });

    const result = await resend.emails.send({
      from: fromEmail,
      to: [adminEmail],
      subject: `[TEST] ${subject}`,
      html,
      text,
    });

    if (result.error) {
      return {
        ok: false,
        error: `Resend API: ${result.error.message ?? "unknown error"}`,
      };
    }

    return { ok: true, recipientEmail: adminEmail };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Test email failed",
    };
  }
}

/**
 * Server-side check da li je Resend konfigurisan + maskirani recipient.
 * Koristi se iz postavke/page.tsx da bi UI prikazao "Konfigurisan / Nije
 * konfigurisan" status prije nego što korisnik klikne test dugme.
 *
 * Maskira email format: `pe***@gmail.com` da ne curi pun adres u DOM-u.
 */
export async function getEmailNotificationConfig(): Promise<{
  configured: boolean;
  recipientPreview: string | null;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

  const configured = !!apiKey && !!fromEmail && !!adminEmail;
  const recipientPreview = adminEmail ? maskEmail(adminEmail) : null;

  return { configured, recipientPreview };
}

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}
