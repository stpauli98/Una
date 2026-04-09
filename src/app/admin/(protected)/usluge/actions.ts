"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAuth() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Nije autorizovan");
  return sb;
}

const serviceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  price: z.number().nonnegative(),
  price_note: z.string().max(100).optional().nullable(),
  duration_min: z.number().int().positive().nullable(),
  duration_note: z.string().max(100).optional().nullable(),
  category: z.enum(["sminkanje", "pedikir", "trepavice", "obuka"]),
  bookable: z.boolean(),
  variable_price: z.boolean(),
  active: z.boolean(),
});

type ServiceInput = z.infer<typeof serviceSchema>;

function parseFormData(fd: FormData): ServiceInput {
  const durationStr = String(fd.get("duration_min") ?? "");
  const duration = durationStr === "" ? null : Number(durationStr);
  return serviceSchema.parse({
    name: String(fd.get("name") ?? ""),
    description: String(fd.get("description") ?? "") || null,
    price: Number(fd.get("price") ?? 0),
    price_note: String(fd.get("price_note") ?? "") || null,
    duration_min: duration,
    duration_note: String(fd.get("duration_note") ?? "") || null,
    category: String(fd.get("category") ?? "sminkanje") as ServiceInput["category"],
    bookable: fd.get("bookable") === "on",
    variable_price: fd.get("variable_price") === "on",
    active: fd.get("active") === "on",
  });
}

export async function createService(formData: FormData): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const parsed = parseFormData(formData);
    const { data: maxOrder } = await sb
      .from("services")
      .select("order_index")
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = (maxOrder?.order_index ?? 0) + 1;
    const { error } = await sb
      .from("services")
      .insert({ ...parsed, order_index: nextOrder });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateService(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const parsed = parseFormData(formData);
    const { error } = await sb.from("services").update(parsed).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function toggleServiceActive(
  id: number,
  active: boolean,
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { error } = await sb
      .from("services")
      .update({ active })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reorderService(
  id: number,
  direction: "up" | "down",
): Promise<ActionResult> {
  try {
    const sb = await requireAuth();
    const { data: current } = await sb
      .from("services")
      .select("id,order_index")
      .eq("id", id)
      .single();
    if (!current) return { ok: false, error: "Usluga nije pronađena" };

    const { data: neighbor } = await sb
      .from("services")
      .select("id,order_index")
      .order("order_index", { ascending: direction === "down" })
      [direction === "up" ? "lt" : "gt"]("order_index", current.order_index)
      .limit(1)
      .maybeSingle();

    if (!neighbor) return { ok: true };

    await sb
      .from("services")
      .update({ order_index: neighbor.order_index })
      .eq("id", current.id);
    await sb
      .from("services")
      .update({ order_index: current.order_index })
      .eq("id", neighbor.id);

    revalidatePath("/admin/usluge");
    revalidatePath("/");
    revalidatePath("/usluge");
    revalidatePath("/cjenovnik");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
