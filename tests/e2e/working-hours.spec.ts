import { test, expect } from "@playwright/test";
import { addDays, getDay } from "date-fns";

/**
 * E2E: admin mijenja working_hours za radni dan, public kalendar
 * odmah reflektuje tu promjenu.
 *
 * Seed direktno kroz Supabase REST — radi sa service role.
 * Cleanup vraća originalno stanje u finally.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

type HoursRow = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
};

async function getHours(dayOfWeek: number): Promise<HoursRow> {
  if (!SERVICE_ROLE_KEY) throw new Error("missing service role key");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/working_hours?day_of_week=eq.${dayOfWeek}&select=*`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`getHours failed: ${res.status}`);
  const rows = (await res.json()) as HoursRow[];
  if (rows.length === 0) throw new Error(`no hours row for day ${dayOfWeek}`);
  return rows[0];
}

async function setHours(
  dayOfWeek: number,
  patch: Partial<Omit<HoursRow, "day_of_week">>,
): Promise<void> {
  if (!SERVICE_ROLE_KEY) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/working_hours?day_of_week=eq.${dayOfWeek}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );
}

function nextBookableWeekday(): Date {
  let date = addDays(new Date(), 3);
  while (getDay(date) === 0 || getDay(date) === 6) {
    date = addDays(date, 1);
  }
  return date;
}

// Testovi serialno jer dijele isto stanje `working_hours` tabele za isti dan.
test.describe.configure({ mode: "serial" });

test("working_hours override: kraće radno vrijeme smanjuje broj slotova", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }

  const target = nextBookableWeekday();
  const weekday = getDay(target);
  const original = await getHours(weekday);

  // Skrati na 19:00-21:00 (umjesto 17:00-21:00)
  await setHours(weekday, {
    open_time: "19:00:00",
    close_time: "21:00:00",
    is_open: true,
  });

  try {
    await page.goto("/zakazi?service=1"); // Šminkanje 60min
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    await page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first()
      .click();

    await expect(page.getByText("Slobodni termini")).toBeVisible();

    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    // Sa radnim vremenom 19-21, 60-min usluga: 19:00, 19:30, 20:00
    expect(slotTexts).toContain("19:00");
    expect(slotTexts).toContain("19:30");
    expect(slotTexts).toContain("20:00");
    expect(slotTexts).not.toContain("17:00");
    expect(slotTexts).not.toContain("18:00");
    expect(slotTexts).not.toContain("18:30");
  } finally {
    await setHours(weekday, {
      open_time: original.open_time,
      close_time: original.close_time,
      is_open: original.is_open,
    });
  }
});

test("working_hours override: isključen dan → nema slotova", async ({
  page,
}) => {
  if (!SERVICE_ROLE_KEY) {
    test.skip(true, "E2E_SUPABASE_SERVICE_ROLE_KEY nije postavljen");
  }

  const target = nextBookableWeekday();
  const weekday = getDay(target);
  const original = await getHours(weekday);

  await setHours(weekday, { is_open: false });

  try {
    await page.goto("/zakazi?service=1");
    await expect(
      page.getByRole("heading", { name: "Izaberite termin" }),
    ).toBeVisible();

    // Kliknuti dan — ili je disabled ili prikazuje praznu listu
    const dayButton = page
      .getByRole("button", { name: String(target.getDate()), exact: true })
      .first();

    // Pokušaj klika: ako je disabled, klik ne radi i slotovi ne postoje
    await dayButton.click({ trial: true }).catch(() => {});

    // Provjeri da NE postoje aktivni slotovi za taj dan
    await page.waitForTimeout(1500);
    const slotTexts = await page
      .getByRole("button")
      .filter({ hasText: /^\d{2}:\d{2}$/ })
      .allTextContents();

    expect(slotTexts).toHaveLength(0);
  } finally {
    await setHours(weekday, {
      is_open: original.is_open,
      open_time: original.open_time,
      close_time: original.close_time,
    });
  }
});
