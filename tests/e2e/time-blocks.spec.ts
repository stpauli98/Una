import { test, expect } from "@playwright/test";
import { addDays, getDay } from "date-fns";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  date.setHours(18, 0, 0, 0);
  return date;
}

async function insertTimeBlock(start: Date, durationMin: number): Promise<number> {
  if (!SERVICE_ROLE_KEY) throw new Error("missing service role");
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/time_blocks`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      reason: "E2E time block test",
    }),
  });
  if (!res.ok) throw new Error(`insert failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ id: number }>;
  return rows[0].id;
}

async function deleteTimeBlock(id: number): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/time_blocks?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
}

test("time block hides overlapping slot from public calendar", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }

  const target = nextBookableWeekday();
  const dayNumber = target.getDate();
  const blockId = await insertTimeBlock(target, 60);

  try {
    await page.goto("/zakazi?service=1"); // Šminkanje 60min
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(dayNumber), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Time block je 18:00-19:00
    // 18:00 slot [18-19] overlaipuje — blokirano
    // 17:30 slot [17:30-18:30] overlaipuje — blokirano
    // 18:30 slot [18:30-19:30] overlaipuje — blokirano
    // 17:00 slot [17-18] granica — NE overlaipuje — slobodno
    // 19:00 slot [19-20] granica — NE overlaipuje — slobodno
    expect(slotTexts).not.toContain("17:30");
    expect(slotTexts).not.toContain("18:00");
    expect(slotTexts).not.toContain("18:30");
    expect(slotTexts).toContain("17:00");
    expect(slotTexts).toContain("19:00");
    expect(slotTexts).toContain("19:30");
    expect(slotTexts).toContain("20:00");
  } finally {
    await deleteTimeBlock(blockId);
  }
});
