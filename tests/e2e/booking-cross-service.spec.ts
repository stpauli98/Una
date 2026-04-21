import { test, expect } from "@playwright/test";
import { addDays, getDay } from "date-fns";

// Oba testa u ovom fajlu seed-uju različite termine na istom datumu
// (deterministic `nextBookableWeekday()`). Paralelno pokretanje bi
// prouzrokovalo interferenciju, pa ih pokrećemo serijski.
test.describe.configure({ mode: "serial" });

/**
 * Cross-service regression test.
 *
 * Una je jedan resurs — ako je zauzeta 17:00–18:00 Šminkanjem, niko ne smije
 * da rezerviše NI JEDNU drugu uslugu koja overlaipuje sa tim intervalom.
 * Ovo proverava da `/api/availability` pravi cross-service blokadu, a ne da
 * filtrira postojeće termine samo po istom service_id.
 *
 * Scenario:
 *   1. Seed: Šminkanje (service_id=1, 60min) u utorak 17:00–18:00
 *   2. Klijent B otvara kalendar za Pedikir (service_id=5, 60min)
 *   3. Bira isti utorak
 *   4. Očekuje: 17:00 slot ODSUTAN (cross-service blocking)
 *   5. Očekuje: 18:00, 19:00, 20:00 slotovi prisutni
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function nextBookableWeekday(): Date {
  // +8 dana da izbjegnemo kolizije, ali ostanemo u istom mjesecu
  let date = addDays(new Date(), 8);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  // Use explicit UTC offset for Sarajevo CEST (UTC+2)
  // to avoid server TZ mismatch
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-based
  const d = date.getDate();
  return new Date(Date.UTC(y, m, d, 15, 0)); // 17:00 CEST = 15:00 UTC
}

async function insertAppointment(
  serviceId: number,
  start: Date,
  durationMin: number,
): Promise<number> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      service_id: serviceId,
      client_name: "E2E Cross-Service Test",
      client_phone: "+38765999777",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "ceka",
    }),
  });
  if (!res.ok) {
    throw new Error(`Seed insert failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

async function deleteAppointment(id: number): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

test("cross-service blocking — Šminkanje 17:00 blocks Pedikir 17:00 slot", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY env var nije postavljen");
  }

  const target = nextBookableWeekday();
  const dayNumber = target.getDate();

  // Seed: Šminkanje (id=1) u 17:00
  const seededId = await insertAppointment(1, target, 60);

  try {
    // Klijent B bira SPA PEDIKIR (id=5, 60min) — DRUGU uslugu
    await page.goto("/zakazi?service=5");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    // Header mora pokazivati Pedikir, ne Šminkanje
    await expect(page.getByText("Spa pedikir")).toBeVisible();

    // Bira isti utorak
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();
    // Wait for availability API to return and render slots
    await expect(
      page.getByRole("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first(),
    ).toBeVisible({ timeout: 10000 });

    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Glavna assertion — 17:00 za Pedikir mora biti SKRIVENO
    // jer je Una zauzeta Šminkanjem u tom vremenu
    expect(slotTexts).not.toContain("17:00");

    // Sanity — ostali slotovi moraju postojati
    expect(slotTexts.length).toBeGreaterThan(0);
    expect(slotTexts).toContain("18:00");
  } finally {
    await deleteAppointment(seededId);
  }
});

test("cross-service blocking — Trepavice 180min conflicts with Šminkanje 18:00", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY env var nije postavljen");
  }

  // Scenario: Šminkanje 18:00–19:00 zauzeto. Klijent B hoće Trepavice (180min).
  // Na weekday (17–21), 180min može da počne u 17:00 (17–20) ili 18:00 (18–21).
  // 17:00–20:00 overlaipuje sa 18:00–19:00 (Šminkanje) → blokirano.
  // 18:00–21:00 overlaipuje sa 18:00–19:00 → blokirano.
  // Rezultat: nula slotova za Trepavice tog dana.
  const target = nextBookableWeekday();
  target.setHours(18, 0, 0, 0); // Šminkanje u 18:00
  const dayNumber = target.getDate();

  const seededId = await insertAppointment(1, target, 60);

  try {
    // Trepavice 1:1 (service_id=8, 180min)
    await page.goto("/zakazi?service=8");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();
    await expect(page.getByText("Trepavice 1:1")).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    // Ili vidimo "Slobodni termini" sa praznom listom, ili "Nema slobodnih termina"
    // Ono što sigurno ne smije: 17:00 ili 18:00 slot ne smije da postoji
    await page.waitForTimeout(1500);
    const slotButtons = page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ });
    const slotTexts = await slotButtons.allTextContents();

    expect(slotTexts).not.toContain("17:00");
    expect(slotTexts).not.toContain("18:00");
  } finally {
    await deleteAppointment(seededId);
  }
});
