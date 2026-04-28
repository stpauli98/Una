"use server";

import { requireAdmin } from "@/lib/supabase/require-admin";

import { revalidatePath } from "next/cache";
import { serviceSchema, type ServiceInput } from "@/lib/services/schema";

type ActionResult = { ok: true } | { ok: false; error: string };


function parseFormData(fd: FormData): ServiceInput {
  const durationStr = String(fd.get("duration_min") ?? "");
  const duration = durationStr === "" ? null : Number(durationStr);
  const priceStr = String(fd.get("price") ?? "");
  const price = priceStr === "" ? null : Number(priceStr);
  return serviceSchema.parse({
    name: String(fd.get("name") ?? ""),
    description: String(fd.get("description") ?? "") || null,
    price,
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
    const sb = await requireAdmin();
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
    const sb = await requireAdmin();
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
    const sb = await requireAdmin();
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
    const sb = await requireAdmin();
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
