import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { notifyDiscordOpenSlotsSummary } from "@/lib/discord/webhook";

export const dynamic = "force-dynamic";

/** Y-M-D for a given instant, read out in a specific IANA timezone — same trick used by the weekly-report cron. */
function ymdInTimeZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(date); // en-CA gives YYYY-MM-DD
}

interface SummaryResult {
  trainId: string;
  trainName: string;
  openSlotCount: number;
}

/**
 * Runs once a day (see vercel.json — scheduled for 8am America/New_York)
 * and, for every published/live train an organizer has attached a Discord
 * webhook to, posts a roundup of the slots still open. A train drops off
 * the list once its event date has passed, so nobody keeps getting pinged
 * about a train that already happened.
 *
 * Protected by CRON_SECRET, same pattern as send-reminders and weekly-report.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const todayEastern = ymdInTimeZone(new Date(), "America/New_York");

  const { data: trains, error: trainsError } = await supabase
    .from("raid_trains")
    .select("id, name, slug, timezone, event_date, discord_webhook_url")
    .in("status", ["published", "live"])
    .not("discord_webhook_url", "is", null)
    .gte("event_date", todayEastern);

  if (trainsError) {
    return NextResponse.json({ error: trainsError.message }, { status: 500 });
  }

  if (!trains || trains.length === 0) {
    return NextResponse.json({ posted: 0, results: [] as SummaryResult[] });
  }

  const results: SummaryResult[] = [];

  for (const train of trains) {
    if (!train.discord_webhook_url) continue;

    const { data: openSlots } = await supabase
      .from("train_slots")
      .select("start_datetime")
      .eq("raid_train_id", train.id)
      .eq("status", "open")
      .order("position", { ascending: true });

    const openSlotTimes = (openSlots ?? []).map((s) => formatSlotTime(s.start_datetime, train.timezone));

    await notifyDiscordOpenSlotsSummary({
      webhookUrl: train.discord_webhook_url,
      trainName: train.name,
      trainUrl: `${siteUrl}/train/${train.slug}`,
      openSlotCount: openSlotTimes.length,
      openSlotTimes,
    });

    results.push({ trainId: train.id, trainName: train.name, openSlotCount: openSlotTimes.length });
  }

  return NextResponse.json({ posted: results.length, results });
}
