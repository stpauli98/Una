"use client";

import { useState, useTransition } from "react";
import { Mail, MailX } from "lucide-react";
import { sendTestAdminEmail } from "@/app/admin/(protected)/postavke/email-actions";

type Props = {
  /** Server-side check: jesu li sve 3 Resend env vars setovane? */
  configured: boolean;
  /** Maskirani recipient ("pe***@gmail.com") ili null ako env missing. */
  recipientPreview: string | null;
};

/**
 * UI za status email notifikacija + jedan-klik test dugme.
 *
 * Razlika od PushNotificationToggle:
 *   - Push notifikacije se subscribe-uju per-uređaj preko browser API-ja
 *     (admin upravlja vlastitom subscription-om)
 *   - Email konfiguracija je server-side (RESEND_API_KEY itd. u env) —
 *     ovaj UI samo prikazuje status i daje "Pošalji test" dugme
 *
 * Test koristi isti `renderNewAppointmentEmail` template kao real flow
 * sa `[TEST]` subject prefix-om — admin vidi tačno kako će email
 * izgledati za prave rezervacije.
 */
export function EmailNotificationStatus({ configured, recipientPreview }: Props) {
  const [pending, startTransition] = useTransition();
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTest = () => {
    setError(null);
    setSuccessInfo(null);
    startTransition(async () => {
      const res = await sendTestAdminEmail();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccessInfo(`Test email poslat na ${res.recipientEmail}`);
      setTimeout(() => setSuccessInfo(null), 6000);
    });
  };

  if (!configured) {
    return (
      <div className="border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <MailX size={14} />
          Nije konfigurisano
        </div>
        <p className="text-[11px]">
          Postavi <code className="font-mono">RESEND_API_KEY</code>,{" "}
          <code className="font-mono">RESEND_FROM_EMAIL</code> i{" "}
          <code className="font-mono">ADMIN_NOTIFICATION_EMAIL</code> u Vercel
          Project Settings → Environment Variables, pa redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[12px] text-body">
        <Mail size={14} className="text-rose" />
        <span>
          Konfigurisano · prima:{" "}
          <span className="font-mono text-dark">{recipientPreview}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onTest}
        disabled={pending}
        className="inline-flex items-center gap-1.5 border border-cream bg-white px-4 py-2 text-[12px] text-dark hover:border-rose hover:text-rose disabled:opacity-50 cursor-pointer"
      >
        <Mail size={13} />
        {pending ? "Šaljem..." : "Pošalji test email"}
      </button>
      {successInfo && (
        <p className="text-[12px] text-green-700">
          ✓ {successInfo}. Provjeri Inbox (i Spam folder za prvi mail).
        </p>
      )}
      {error && <p className="text-[12px] text-rose">{error}</p>}
    </div>
  );
}
