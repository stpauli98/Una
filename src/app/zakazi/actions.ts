"use server";

import { addMinutes } from "date-fns";
import { redirect } from "next/navigation";
import { bookingFormSchema } from "@/lib/booking/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeBaPhone } from "@/lib/utils/phone";

export type CreateAppointmentResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createAppointment(
  formData: FormData,
): Promise<CreateAppointmentResult> {
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
  const end = addMinutes(start, service.duration_min);

  // Race guard: provjeri da se slot nije upravo zauzeo
  const { data: clashing, error: clashErr } = await sb
    .from("appointments")
    .select("id")
    .in("status", ["ceka", "potvrdjen"])
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString())
    .limit(1);

  if (clashErr) {
    console.error("race-guard query failed:", clashErr);
    return { ok: false, error: "Greška pri provjeri termina, pokušajte ponovo" };
  }
  if (clashing && clashing.length > 0) {
    return {
      ok: false,
      error:
        "Ovaj termin je upravo zauzet. Vratite se i izaberite drugi slobodan termin.",
    };
  }

  const { data: inserted, error: insErr } = await sb
    .from("appointments")
    .insert({
      service_id: parsed.data.service_id,
      client_name: parsed.data.client_name,
      client_phone: normalizeBaPhone(parsed.data.client_phone),
      client_email: parsed.data.client_email || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notes: parsed.data.notes || null,
      status: "ceka",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("appointment insert failed:", insErr);
    return {
      ok: false,
      error: "Došlo je do greške pri spremanju. Molimo pokušajte ponovo.",
    };
  }

  // TODO(Phase 8): sendNewAppointmentEmail(inserted, service, parsed.data)

  redirect(`/zakazi/uspjesno?id=${inserted.id}`);
}
