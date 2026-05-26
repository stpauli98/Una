"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";
import { addMinutes } from "date-fns";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { manualAppointmentSchema } from "@/lib/booking/schemas";
import { normalizePhone } from "@/lib/utils/phone";
import { isGridAligned } from "@/lib/utils/grid";
import { sendClientConfirmationEmail } from "@/lib/notifications/send-client-email";
import { sendCancellationEmail } from "@/lib/notifications/send-cancellation-email";
import { normalizeSiteUrl } from "@/lib/utils/site-url";

type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateManualAppointmentResult =
  | { ok: true; id: number }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      conflict?: boolean;
    };


export async function confirmAppointment(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();
    const { error } = await sb
      .from("appointments")
      .update({
        status: "potvrdjen",
        confirmation_sent_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");

    // Dohvati appointment + service za confirmation email payload
    const { data: appt } = await sb
      .from("appointments")
      .select("client_name, client_phone, client_email, start_time, end_time, notes, services(name)")
      .eq("id", id)
      .single();

    if (appt?.client_email) {
      const adminPanelUrl = `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`;
      after(() =>
        sendClientConfirmationEmail({
          appointmentId: id,
          clientName: appt.client_name,
          clientPhone: appt.client_phone,
          clientEmail: appt.client_email,
          serviceName: appt.services?.name ?? "",
          startTime: new Date(appt.start_time),
          endTime: new Date(appt.end_time),
          notes: appt.notes,
          adminPanelUrl,
        }),
      );
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cancelAppointment(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();

    // Dohvati appointment + service PRIJE update-a za cancel email
    const { data: appt } = await sb
      .from("appointments")
      .select("client_name, client_phone, client_email, start_time, end_time, notes, status, services(name)")
      .eq("id", id)
      .single();

    const { error } = await sb
      .from("appointments")
      .update({ status: "otkazan" })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");

    if (appt?.client_email && (appt.status === "ceka" || appt.status === "potvrdjen")) {
      const adminPanelUrl = `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`;
      after(() =>
        sendCancellationEmail({
          appointmentId: id,
          clientName: appt.client_name,
          clientPhone: appt.client_phone,
          clientEmail: appt.client_email,
          serviceName: appt.services?.name ?? "",
          startTime: new Date(appt.start_time),
          endTime: new Date(appt.end_time),
          notes: appt.notes,
          adminPanelUrl,
          previousStatus: appt.status as "ceka" | "potvrdjen",
        }),
      );
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function markCompleted(id: number): Promise<ActionResult> {
  try {
    const sb = await requireAdmin();

    // Fetch current service price za snapshot
    const { data: appt, error: fetchErr } = await sb
      .from("appointments")
      .select("services(price)")
      .eq("id", id)
      .single();

    if (fetchErr || !appt) {
      return {
        ok: false,
        error: fetchErr?.message ?? "Termin nije pronađen",
      };
    }

    // services može biti null ako je servis obrisan (FK ON DELETE SET NULL).
    // U tom slučaju snapshot ostaje null — admin može mark zavrsen ali
    // revenue za taj termin neće biti uračunat. Rijetka edge case.
    const priceSnapshot = appt.services?.price ?? null;

    const { error: updateErr } = await sb
      .from("appointments")
      .update({
        status: "zavrsen",
        price_snapshot: priceSnapshot,
      })
      .eq("id", id);

    if (updateErr) return { ok: false, error: updateErr.message };

    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createManualAppointment(
  formData: FormData,
): Promise<CreateManualAppointmentResult> {
  try {
    const sb = await requireAdmin();

    const raw = {
      service_id: Number(formData.get("service_id") ?? 0),
      start_time: String(formData.get("start_time") ?? ""),
      client_name: String(formData.get("client_name") ?? ""),
      client_phone: String(formData.get("client_phone") ?? ""),
      client_email: String(formData.get("client_email") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      force: formData.get("force") === "true",
    };

    const parsed = manualAppointmentSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Provjerite podatke u formi",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }

    const { data: service } = await sb
      .from("services")
      .select("id,duration_min,name")
      .eq("id", parsed.data.service_id)
      .maybeSingle();

    if (!service || !service.duration_min) {
      return { ok: false, error: "Usluga nije pronađena ili nema trajanje" };
    }

    const start = new Date(parsed.data.start_time);
    if (!isGridAligned(start)) {
      return {
        ok: false,
        error: "Vrijeme termina mora biti na pun sat ili pola (:00 ili :30)",
      };
    }
    const end = addMinutes(start, service.duration_min);

    if (!parsed.data.force) {
      const { data: clashing } = await sb
        .from("appointments")
        .select("id,client_name")
        .in("status", ["ceka", "potvrdjen"])
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString())
        .limit(1);

      if (clashing && clashing.length > 0) {
        return {
          ok: false,
          conflict: true,
          error: `Konflikt sa postojećim terminom: ${clashing[0].client_name}. Možete svejedno dodati.`,
        };
      }
    }

    const { data: inserted, error } = await sb
      .from("appointments")
      .insert({
        service_id: parsed.data.service_id,
        client_name: parsed.data.client_name,
        client_phone: normalizePhone(parsed.data.client_phone),
        client_email: parsed.data.client_email || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: parsed.data.notes || null,
        status: "potvrdjen",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { ok: false, error: error?.message ?? "Greška pri spremanju" };
    }

    revalidatePath("/admin/termini");
    revalidatePath("/admin/dashboard");

    // Manual appointment = odmah potvrđen, šalje confirmation + .ics
    if (parsed.data.client_email) {
      const adminPanelUrl = `${normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)}/admin/termini`;
      after(() =>
        sendClientConfirmationEmail({
          appointmentId: inserted.id,
          clientName: parsed.data.client_name,
          clientPhone: normalizePhone(parsed.data.client_phone),
          clientEmail: parsed.data.client_email || null,
          serviceName: service.name,
          startTime: start,
          endTime: end,
          notes: parsed.data.notes || null,
          adminPanelUrl,
        }),
      );
    }

    return { ok: true, id: inserted.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
