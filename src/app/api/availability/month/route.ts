import { NextResponse, type NextRequest } from "next/server";
import { parseISO, startOfMonth, endOfMonth, addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMonthAvailability } from "@/lib/booking/month-availability";
import { hoursMapFromRows } from "@/lib/booking/rules";
import { parseBookingSettings } from "@/lib/settings/read";
import { checkRateLimit } from "@/lib/utils/rate-limit";

// Mora čitati svježe podatke — slotovi se mijenjaju kako klijenti rezervišu.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/availability/month?month=YYYY-MM&service_id=N
 * Vraća { availability: Record<YYYY-MM-DD, boolean> } za sve dane u mjesecu.
 *
 * `true` = dan ima barem jedan slobodan slot za uslugu.
 * `false` = dan je popunjen / blokiran / van radnog vremena.
 *
 * Koristi service role klijent (zaobilazi RLS) jer anon nema SELECT
 * privilegije na `appointments`. Klijent dobija samo izračunatu mapu —
 * nikad sirove podatke o terminima.
 */
export async function GET(req: NextRequest) {
  // Rate limit: 30 requests per minute per IP (isti kao single-day)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!(await checkRateLimit(ip, 30, 60_000))) {
    return NextResponse.json(
      { error: "Previše zahtjeva. Pokušajte ponovo za minutu." },
      { status: 429 },
    );
  }

  const monthStr = req.nextUrl.searchParams.get("month");
  const serviceIdStr = req.nextUrl.searchParams.get("service_id");

  // Verify admin session before trusting the admin flag (same pattern as /api/availability)
  let isAdmin = false;
  if (req.nextUrl.searchParams.get("admin") === "true") {
    const { createClient } = await import("@/lib/supabase/server");
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    isAdmin = !!user;
  }

  if (!monthStr || !serviceIdStr) {
    return NextResponse.json(
      { error: "Nedostaju parametri: month i service_id" },
      { status: 400 },
    );
  }

  // Validate month format YYYY-MM
  const monthMatch = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!monthMatch) {
    return NextResponse.json(
      { error: "Neispravan month (očekivani format YYYY-MM)" },
      { status: 400 },
    );
  }
  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return NextResponse.json({ error: "Neispravan month" }, { status: 400 });
  }

  const serviceId = Number(serviceIdStr);
  if (!Number.isFinite(serviceId) || serviceId <= 0) {
    return NextResponse.json(
      { error: "Neispravan service_id" },
      { status: 400 },
    );
  }

  const sb = createAdminClient();

  const { data: service, error: serviceError } = await sb
    .from("services")
    .select("id,duration_min,bookable,active")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError) {
    return NextResponse.json({ error: serviceError.message }, { status: 500 });
  }
  if (!service || !service.bookable || !service.active || !service.duration_min) {
    // Service ne postoji ili nije bookable — vrati prazan map
    return NextResponse.json({ availability: {} });
  }

  // Query range: cijeli mjesec u UTC. Plus jedan dan buffer sa svake
  // strane da uhvatimo termine/time-blocks koji preliježu granicu.
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const monthStart = startOfMonth(firstDay);
  const monthEnd = endOfMonth(firstDay);
  const queryStart = addDays(monthStart, -1).toISOString();
  const queryEnd = addDays(monthEnd, 2).toISOString();

  const [apptRes, blockedRes, hoursRes, timeBlocksRes, settingsRes] =
    await Promise.all([
      sb
        .from("appointments")
        .select("start_time,end_time")
        .gte("start_time", queryStart)
        .lt("start_time", queryEnd)
        .in("status", ["ceka", "potvrdjen"]),
      sb.from("blocked_dates").select("date_from,date_to"),
      sb.from("working_hours").select("day_of_week,open_time,close_time,is_open"),
      sb
        .from("time_blocks_public")
        .select("start_time,end_time")
        .lt("start_time", queryEnd)
        .gt("end_time", queryStart),
      sb.from("settings").select("key,value"),
    ]);

  if (apptRes.error) {
    return NextResponse.json({ error: apptRes.error.message }, { status: 500 });
  }
  if (blockedRes.error) {
    return NextResponse.json(
      { error: blockedRes.error.message },
      { status: 500 },
    );
  }
  if (hoursRes.error) {
    return NextResponse.json(
      { error: hoursRes.error.message },
      { status: 500 },
    );
  }
  if (timeBlocksRes.error) {
    return NextResponse.json(
      { error: timeBlocksRes.error.message },
      { status: 500 },
    );
  }
  if (settingsRes.error) {
    return NextResponse.json(
      { error: settingsRes.error.message },
      { status: 500 },
    );
  }

  const bookingSettings = parseBookingSettings(settingsRes.data ?? []);

  const availability = getMonthAvailability({
    year,
    month,
    durationMin: service.duration_min,
    now: new Date(),
    existing: (apptRes.data ?? []).map((a) => ({
      start: new Date(a.start_time),
      end: new Date(a.end_time),
    })),
    blocked: (blockedRes.data ?? []).map((b) => ({
      from: parseISO(b.date_from),
      to: parseISO(b.date_to),
    })),
    hoursByWeekday: hoursMapFromRows(hoursRes.data ?? []),
    blockedTimes: (timeBlocksRes.data ?? [])
      .filter((t) => t.start_time != null && t.end_time != null)
      .map((t) => ({
        start: new Date(t.start_time!),
        end: new Date(t.end_time!),
      })),
    skipMinHoursBefore: isAdmin,
    settings: bookingSettings,
  });

  return NextResponse.json({ availability });
}
