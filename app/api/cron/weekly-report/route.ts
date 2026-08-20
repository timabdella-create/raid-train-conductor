import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

// Attendance outcomes that mean the seller didn't actually ride, even though
// they were confirmed for a slot — excluded from the "rode this week" count.
const DID_NOT_RIDE = new Set(["cancelled_with_notice", "last_minute_cancellation", "no_show"]);

/** Y-M-D for a given instant, read out in a specific IANA timezone. No time-of-day, matching how event_date (a plain `date` column) is stored and compared. */
function ymdInTimeZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(date); // en-CA gives YYYY-MM-DD
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.split("-");
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) };
}

function addDays(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function dayOfWeek(ymd: string): number {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}

function formatDisplayDate(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

/**
 * Weekly stats email: how many distinct organizers/riders were active in the
 * last Monday–Sunday window, and how many trains each of them organized or
 * rode. Intended to run once, Sunday night — see vercel.json — but the week
 * boundary is derived from the report's own timezone rather than assuming
 * "today" so a cron misfire a few hours off (e.g. across a DST change)
 * still reports the correct week.
 *
 * Protected by CRON_SECRET, same convention as send-reminders.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const reportTimeZone = process.env.WEEKLY_REPORT_TIMEZONE || "America/New_York";
  const recipient = process.env.WEEKLY_REPORT_EMAIL || "timabdella@gmail.com";

  const todayYmd = ymdInTimeZone(new Date(), reportTimeZone);
  // Walk back to the most recent Sunday (today, if today already is one).
  const weekEnd = addDays(todayYmd, -dayOfWeek(todayYmd));
  const weekStart = addDays(weekEnd, -6);

  const supabase = createAdminClient();

  const { data: trains, error: trainsError } = await supabase
    .from("raid_trains")
    .select("id, organizer_id")
    .gte("event_date", weekStart)
    .lte("event_date", weekEnd)
    .neq("status", "cancelled");

  if (trainsError) {
    return NextResponse.json({ error: trainsError.message }, { status: 500 });
  }

  const weekTrains = trains ?? [];
  const trainIds = weekTrains.map((t) => t.id);

  const organizerCounts = new Map<string, number>();
  for (const t of weekTrains) {
    organizerCounts.set(t.organizer_id, (organizerCounts.get(t.organizer_id) ?? 0) + 1);
  }

  const { data: participants, error: participantsError } =
    trainIds.length > 0
      ? await supabase
          .from("train_participants")
          .select("seller_id, attendance_status")
          .in("raid_train_id", trainIds)
          .eq("confirmation_status", "confirmed")
      : { data: [] as { seller_id: string; attendance_status: string }[], error: null };

  if (participantsError) {
    return NextResponse.json({ error: participantsError.message }, { status: 500 });
  }

  const sellerCounts = new Map<string, number>();
  for (const p of participants ?? []) {
    if (DID_NOT_RIDE.has(p.attendance_status)) continue;
    sellerCounts.set(p.seller_id, (sellerCounts.get(p.seller_id) ?? 0) + 1);
  }

  const organizerIds = [...organizerCounts.keys()];
  const { data: organizerProfiles } =
    organizerIds.length > 0
      ? await supabase.from("organizer_profiles").select("id, organizer_name").in("id", organizerIds)
      : { data: [] as { id: string; organizer_name: string }[] };
  const organizerNameById = new Map((organizerProfiles ?? []).map((o) => [o.id, o.organizer_name]));

  const sellerIds = [...sellerCounts.keys()];
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("seller_profiles").select("id, user_id, whatnot_username").in("id", sellerIds)
      : { data: [] as { id: string; user_id: string; whatnot_username: string | null }[] };
  const userIds = [...new Set((sellerProfiles ?? []).map((s) => s.user_id))];
  const { data: profileRows } =
    userIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
      : { data: [] as { user_id: string; display_name: string }[] };
  const displayNameByUserId = new Map((profileRows ?? []).map((p) => [p.user_id, p.display_name]));
  const sellerLabelById = new Map(
    (sellerProfiles ?? []).map((s) => [
      s.id,
      displayNameByUserId.get(s.user_id) || s.whatnot_username || "Unknown seller",
    ])
  );

  const organizerRows = [...organizerCounts.entries()]
    .map(([id, count]) => ({ name: organizerNameById.get(id) ?? "Unknown organizer", count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const sellerRows = [...sellerCounts.entries()]
    .map(([id, count]) => ({ name: sellerLabelById.get(id) ?? "Unknown seller", count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const rangeLabel = `${formatDisplayDate(weekStart)} – ${formatDisplayDate(weekEnd)}`;

  const rowsToHtml = (rows: { name: string; count: number }[]) =>
    rows.length > 0
      ? `<ul style="margin:0;padding-left:20px;">${rows
          .map((r) => `<li>${escapeHtml(r.name)} — ${r.count} train${r.count === 1 ? "" : "s"}</li>`)
          .join("")}</ul>`
      : `<p style="color:#888;margin:0;">None this week.</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h1 style="font-size:20px;">Weekly Raid Train Report</h1>
      <p style="color:#666;">${rangeLabel}</p>
      <h2 style="font-size:16px;margin-top:24px;">Organizers (${organizerRows.length})</h2>
      ${rowsToHtml(organizerRows)}
      <h2 style="font-size:16px;margin-top:24px;">Riders (${sellerRows.length})</h2>
      ${rowsToHtml(sellerRows)}
    </div>
  `;

  const textLines = [
    `Weekly Raid Train Report — ${rangeLabel}`,
    "",
    `Organizers (${organizerRows.length}):`,
    ...(organizerRows.length > 0
      ? organizerRows.map((r) => `- ${r.name} — ${r.count} train${r.count === 1 ? "" : "s"}`)
      : ["None this week."]),
    "",
    `Riders (${sellerRows.length}):`,
    ...(sellerRows.length > 0
      ? sellerRows.map((r) => `- ${r.name} — ${r.count} train${r.count === 1 ? "" : "s"}`)
      : ["None this week."]),
  ];

  const result = await sendEmail({
    to: recipient,
    subject: `Weekly Raid Train Report — ${rangeLabel}`,
    html,
  });

  return NextResponse.json({
    weekStart,
    weekEnd,
    organizerCount: organizerRows.length,
    sellerCount: sellerRows.length,
    organizerRows,
    sellerRows,
    emailSent: result.sent,
    emailError: result.error,
    textPreview: textLines.join("\n"),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
