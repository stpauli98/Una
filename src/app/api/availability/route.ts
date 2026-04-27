import { NextResponse, type NextRequest } from "next/server";
import { parseISO, startOfDay, endOfDay, addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAvailableSlots } from "@/lib/booking/availability";
import { hoursMapFromRows } from "@/lib/booking/rules";
import { parseBookingSettings } from "@/lib/settings/read";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { parseDateSarajevo, nowSarajevo } from "@/lib/utils/tz";

// Ova ruta mora uvijek čitati svježe podatke — baza se mijenja u realnom
// vremenu kada klijenti rezervišu termine. Keš bi prikazao zastarjele slotove.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/availability?date=YYYY-MM-DD&service_id=N
 * Vraća listu raspoloživih slotova za dati dan i uslugu.
 *
 * Koristi service role klijent (zaobilazi RLS) jer anon nema SELECT
 * privilegije na `appointments` tabeli. Browser i dalje dobija samo
 * izračunatu listu slobodnih slotova — nikad sirove podatke o terminima.
 */
export async function GET(req: NextRequest) {
  // Rate limit: 30 requests per minute per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip, 30, 60_000)) {
    return NextResponse.json(
      { error: "Previše zahtjeva. Pokušajte ponovo za minutu." },
      { status: 429 },
    );
  }

  const dateStr = req.nextUrl.searchParams.get("date");
  const serviceIdStr = req.nextUrl.searchParams.get("service_id");
  // Verify admin session before trusting the admin flag
  let isAdmin = false;
  if (req.nextUrl.searchParams.get("admin") === "true") {
    const { createClient } = await import("@/lib/supabase/server");
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    isAdmin = !!user;
  }

  if (!dateStr || !serviceIdStr) {
    return NextResponse.json(
      { error: "Nedostaju parametri: date i service_id" },
      { status: 400 },
    );
  }

  const serviceId = Number(serviceIdStr);
  if (!Number.isFinite(serviceId) || serviceId <= 0) {
    return NextResponse.json({ error: "Neispravan service_id" }, { status: 400 });
  }

  let date: Date;
  try {
    // Parse as midnight in Europe/Sarajevo (not UTC)
    date = parseDateSarajevo(dateStr);
    if (Number.isNaN(date.getTime())) throw new Error("nan");
  } catch {
    return NextResponse.json({ error: "Neispravan datum" }, { status: 400 });
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
    return NextResponse.json({ slots: [] });
  }

  // Query range: from Sarajevo midnight to Sarajevo midnight+24h
  const dayStart = date.toISOString();
  const dayEnd = addDays(date, 1).toISOString();

  // Time blocks mogu početi prije targetiranog dana a završiti unutar njega,
  // ili početi unutar i završiti kasnije. Tražimo sve blokove koji se
  // overlaipuju sa danom: `start_time < dayEnd AND end_time > dayStart`.
  const [apptRes, blockedRes, hoursRes, timeBlocksRes, settingsRes] =
    await Promise.all([
      sb
        .from("appointments")
        .select("start_time,end_time")
        .gte("start_time", dayStart)
        .lt("start_time", dayEnd)
        .in("status", ["ceka", "potvrdjen"]),
      sb.from("blocked_dates").select("date_from,date_to"),
      sb.from("working_hours").select("day_of_week,open_time,close_time,is_open"),
      sb
        .from("time_blocks_public")
        .select("start_time,end_time")
        .lt("start_time", dayEnd)
        .gt("end_time", dayStart),
      sb.from("settings").select("key,value"),
    ]);

  if (apptRes.error) {
    return NextResponse.json({ error: apptRes.error.message }, { status: 500 });
  }
  if (blockedRes.error) {
    return NextResponse.json({ error: blockedRes.error.message }, { status: 500 });
  }
  if (hoursRes.error) {
    return NextResponse.json({ error: hoursRes.error.message }, { status: 500 });
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

  const slots = computeAvailableSlots({
    date,
    durationMin: service.duration_min,
    now: nowSarajevo(),
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

  return NextResponse.json({
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    })),
  });
}
