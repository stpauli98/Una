"use server";

import { addMinutes, differenceInHours } from "date-fns";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { bookingFormSchema } from "@/lib/booking/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";
import { normalizePhone } from "@/lib/utils/phone";
import { isGridAligned } from "@/lib/utils/grid";
import { parseBookingSettings } from "@/lib/settings/read";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { sanitizeError } from "@/lib/utils/log";
import { headers } from "next/headers";
import {
  buildNewAppointmentPayload,
  sendAdminPushNotification,
} from "@/lib/push/send";
import { sendNewAppointmentEmail } from "@/lib/notifications/send-admin-email";
import { sendBookingReceivedEmail } from "@/lib/notifications/send-booking-received-email";
import { sarajevoDateStr } from "@/lib/utils/day-bounds";
import { validateSlotServerSide } from "@/lib/booking/validate-slot";

export type CreateAppointmentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createAppointment(
  formData: FormData,
): Promise<CreateAppointmentResult> {
  // Rate limit: 5 booking attempts per minute per IP
  const hdrs = await headers();
  const ip = getClientIp(hdrs);
  if (!(await checkRateLimit(ip, 5, 60_000, { failClosed: true }))) {
    return { ok: false, error: "Previše zahtjeva. Pokušajte ponovo za minutu." };
  }

  const raw = {
    service_id: Number(formData.get("service_id") ?? 0),
    start_time: String(formData.get("start_time") ?? ""),
    client_name: String(formData.get("client_name") ?? ""),
    client_phone: String(formData.get("client_phone") ?? ""),
    client_email: String(formData.get("client_email") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    consent: formData.get("consent") === "true" ? true : undefined,
  };

  const parsed = bookingFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Molimo provjerite podatke u formi",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const sb = createAdminClient();

  // Provjeri uslugu
  const { data: service, error: svcErr } = await sb
    .from("services")
    .select("id,duration_min,bookable,active,name")
    .eq("id", parsed.data.service_id)
    .maybeSingle();

  if (svcErr || !service) {
    return { ok: false, error: "Usluga nije pronađena" };
  }
  if (!service.bookable || !service.active || !service.duration_min) {
    return { ok: false, error: "Ova usluga nije trenutno dostupna za online zakazivanje" };
  }

  const start = new Date(parsed.data.start_time);
  if (!isGridAligned(start)) {
    return {
      ok: false,
      error: "Vrijeme termina mora biti na pun sat ili pola (:00 ili :30)",
    };
  }
  const end = addMinutes(start, service.duration_min);

  // Server-side min_hours_before enforcement
  const { data: settingsRows } = await sb.from("settings").select("key,value");
  const bookingSettings = parseBookingSettings(settingsRows ?? []);
  const hoursUntilStart = differenceInHours(start, new Date());
  if (hoursUntilStart < bookingSettings.minHoursBefore) {
    return {
      ok: false,
      error: `Rezervacija mora biti najmanje ${bookingSettings.minHoursBefore}h unaprijed`,
    };
  }

  const slotCheck = await validateSlotServerSide(sb, start, end);
  if (!slotCheck.valid) {
    return { ok: false, error: slotCheck.reason ?? "Slot nije dostupan" };
  }

  // Race guard: provjeri da se slot nije upravo zauzeo
  const { data: clashing, error: clashErr } = await sb
    .from("appointments")
    .select("id")
    .in("status", ["ceka", "potvrdjen"])
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .limit(1);

  if (clashErr) {
    console.error("race-guard query failed:", sanitizeError(clashErr));
    return { ok: false, error: "Greška pri provjeri termina, pokušajte ponovo" };
  }
  if (clashing && clashing.length > 0) {
    return {
      ok: false,
      error:
        "Ovaj termin je upravo zauzet. Vratite se i izaberite drugi slobodan termin.",
    };
  }

  const confirmationToken = crypto.randomUUID();
  const normalizedPhone = normalizePhone(parsed.data.client_phone);
  const clientEmail = parsed.data.client_email || null;
  const notes = parsed.data.notes || null;

  const anonSb = createPublicClient();

  const { data: inserted, error: insErr } = await anonSb
    .from("appointments")
    .insert({
      service_id: parsed.data.service_id,
      client_name: parsed.data.client_name,
      client_phone: normalizedPhone,
      client_email: clientEmail,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notes,
      status: "ceka",
      confirmation_token: confirmationToken,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("appointment insert failed:", sanitizeError(insErr));
    return {
      ok: false,
      error: "Došlo je do greške pri spremanju. Molimo pokušajte ponovo.",
    };
  }

  // Fire-and-log email obavještenje Uni — NE blokira redirect.
  // `after()` (Next 16) garantuje da se email izvrši nakon response-a,
  // čak i kad redirect() prekine handler. `void` + redirect na Vercel
  // serverless može orphanovati promise prije nego Resend fetch završi.
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://upbeauty.ba"
  ).replace(/\/$/, "");
  after(() =>
    sendNewAppointmentEmail({
      appointmentId: inserted.id,
      clientName: parsed.data.client_name,
      clientPhone: normalizedPhone,
      clientEmail,
      serviceName: service.name,
      startTime: start,
      endTime: end,
      notes,
      adminPanelUrl: `${siteUrl}/admin/termini?date=${sarajevoDateStr(start)}&focus=${inserted.id}`,
    }),
  );

  // Fire-and-log "primljeno" email klijentu — bez .ics, šalje odmah.
  // Potvrda + .ics stiže tek kad Una potvrdi termin (confirmAppointment).
  after(() =>
    sendBookingReceivedEmail({
      appointmentId: inserted.id,
      clientName: parsed.data.client_name,
      clientPhone: normalizedPhone,
      clientEmail,
      serviceName: service.name,
      startTime: start,
      endTime: end,
      notes,
      adminPanelUrl: `${siteUrl}/admin/termini?date=${sarajevoDateStr(start)}&focus=${inserted.id}`,
    }),
  );

  // Push notification adminima — best-effort, ne čekaj i ne baci.
  // Ako Una uskoro otvori admin, AppointmentsRealtime (Phase B) već
  // pokazuje novi termin. Push je dodatni signal kad admin nije otvoren.
  void sendAdminPushNotification(
    buildNewAppointmentPayload({
      clientName: parsed.data.client_name,
      serviceName: service.name,
      startTime: start,
    }),
  );

  redirect(`/zakazi/uspjesno?token=${confirmationToken}`);
}
