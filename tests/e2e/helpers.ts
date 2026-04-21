export const SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SERVICE_ROLE_KEY =
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

export function supabaseHeaders() {
  if (!SERVICE_ROLE_KEY)
    throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function insertAppointment(
  serviceId: number,
  start: Date,
  durationMin: number,
  clientName = "E2E Test",
  status: "ceka" | "potvrdjen" = "ceka",
): Promise<number> {
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      service_id: serviceId,
      client_name: clientName,
      client_phone: "+38765999777",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status,
    }),
  });
  if (!res.ok) throw new Error(`Seed insert failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

export async function deleteAppointment(id: number): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
    method: "DELETE",
    headers: supabaseHeaders(),
  });
}

export async function getAppointment(id: number) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}&select=*`,
    { headers: supabaseHeaders() },
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function getAppointmentByName(name: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=eq.${encodeURIComponent(name)}&select=*&order=created_at.desc&limit=1`,
    { headers: supabaseHeaders() },
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function updateAppointmentStatus(
  id: number,
  status: string,
): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
    method: "PATCH",
    headers: supabaseHeaders(),
    body: JSON.stringify({ status }),
  });
}

export async function cleanupByName(name: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=eq.${encodeURIComponent(name)}`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}

export async function cleanupByPrefix(prefix: string): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?client_name=like.${prefix}*`,
    { method: "DELETE", headers: supabaseHeaders() },
  );
}
