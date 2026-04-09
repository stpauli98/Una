"use server";

import { trainingInquirySchema } from "@/lib/booking/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeBaPhone } from "@/lib/utils/phone";

export type TrainingInquiryResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitTrainingInquiry(
  formData: FormData,
): Promise<TrainingInquiryResult> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  const parsed = trainingInquirySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Molimo provjerite podatke u formi",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const sb = createAdminClient();
  const { error } = await sb.from("training_inquiries").insert({
    name: parsed.data.name,
    phone: normalizeBaPhone(parsed.data.phone),
    email: parsed.data.email || null,
    message: parsed.data.message || null,
  });

  if (error) {
    console.error("training_inquiries insert failed:", error);
    return {
      ok: false,
      error: "Došlo je do greške pri slanju. Pokušajte ponovo.",
    };
  }

  // TODO(Phase 8): sendTrainingInquiryEmail(parsed.data)

  return { ok: true };
}
