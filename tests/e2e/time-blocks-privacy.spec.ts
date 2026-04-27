import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL!;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe("time_blocks privacy", () => {
  let createdId: number | null = null;

  test.beforeAll(async () => {
    const admin = createClient(url, serviceKey);
    // Seed time block sa osjetljivim reason-om
    const future = new Date();
    future.setDate(future.getDate() + 30);
    future.setHours(10, 0, 0, 0);
    const end = new Date(future);
    end.setHours(11, 0, 0, 0);

    const { data, error } = await admin
      .from("time_blocks")
      .insert({
        start_time: future.toISOString(),
        end_time: end.toISOString(),
        reason: "E2E_TEST_PRIVATE_ZUBAR",
      })
      .select("id")
      .single();
    if (error) throw error;
    createdId = data.id;
  });

  test.afterAll(async () => {
    if (createdId == null) return;
    const admin = createClient(url, serviceKey);
    await admin.from("time_blocks").delete().eq("id", createdId);
  });

  test("anon ne može pročitati reason direktnim SELECT-om", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon
      .from("time_blocks")
      .select("reason")
      .eq("id", createdId!);
    // Očekujemo ili explicit denial (error) ili praznu listu (empty array)
    // — ne smije vratiti reason vrijednost.
    const leaked =
      !error &&
      Array.isArray(data) &&
      data.length > 0 &&
      data.some((r) => (r as { reason?: string }).reason === "E2E_TEST_PRIVATE_ZUBAR");
    expect(leaked).toBe(false);
  });

  test("anon kroz public view dobija seedovan red sa start/end ali bez reason", async () => {
    const anon = createClient(url, anonKey);
    const { data, error } = await anon
      .from("time_blocks_public")
      .select("*")
      .gte("start_time", new Date().toISOString());
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // Verifikuj da je seedovan blok stvarno vidljiv kroz view
    const seeded = (data ?? []).find(
      (r) =>
        r.start_time != null &&
        new Date(r.start_time).getTime() > Date.now() + 28 * 24 * 60 * 60 * 1000,
    );
    expect(seeded).toBeDefined();
    expect(seeded?.start_time).toBeTruthy();
    expect(seeded?.end_time).toBeTruthy();
    // Reason kolona NE smije biti prisutna na view-u
    expect("reason" in (seeded as object)).toBe(false);
  });
});
