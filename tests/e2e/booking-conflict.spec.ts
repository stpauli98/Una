import { test, expect } from "@playwright/test";
import { addDays, getDay } from "date-fns";

/**
 * Regression test za bug: klijent B ne smije vidjeti kao slobodan slot
 * koji je klijent A već rezervisao. Prije fix-a, ovaj test failuje —
 * jer anon RLS politika na `appointments` tabeli blokira SELECT pa
 * /api/availability nikad ne dobije postojeće termine.
 *
 * Seed: preko Supabase REST API sa service role ključem ubacujemo jedan
 * termin. Cleanup u finally bloku, istim putem brišemo samo taj termin.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

/** Nađi prvi weekday (pon-pet) najmanje 3 dana u budućnosti, sa sigurnim 17:00 slotom. */
function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(17, 0, 0, 0);
  return date;
}

async function insertAppointment(start: Date): Promise<number> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error("E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      service_id: 1,
      client_name: "E2E Conflict Test",
      client_phone: "+38765999888",
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

test("booking conflict — taken slot is hidden from other clients", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY env var nije postavljen");
  }

  const target = nextBookableWeekday();
  const dayNumber = target.getDate();
  const seededId = await insertAppointment(target);

  try {
    // Klijent B dolazi na /zakazi, bira Šminkanje (service_id=1, 60min)
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    // Bira isti dan
    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    // Sačekaj da se slotovi učitaju
    await expect(page.getByText("Slobodni termini")).toBeVisible();

    // Pročitaj sve vidljive slot dugmeta
    const slotButtons = page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ });
    const slotTexts = await slotButtons.allTextContents();

    // Glavna assertion — 17:00 slot NE smije biti u listi
    expect(slotTexts).not.toContain("17:00");

    // Sanity — drugi slotovi moraju i dalje postojati
    expect(slotTexts.length).toBeGreaterThan(0);
    expect(slotTexts).toContain("18:00");
  } finally {
    await deleteAppointment(seededId);
  }
});
