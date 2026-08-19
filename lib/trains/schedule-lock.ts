import type { createClient } from "@/lib/supabase/server";

/**
 * True once anyone has actually engaged with a train's schedule — a
 * confirmed seller (train_participants) or an application still pending a
 * decision. Editing the date/time/slot-length wipes and regenerates every
 * slot, so this is the real safety line: it doesn't matter whether the
 * train is a draft or has been live for weeks, only whether someone has
 * committed to (or is waiting on) a specific slot. Zero engagement means
 * it's safe to edit the schedule on a published train without unpublishing
 * first; any engagement means the schedule locks until it's resolved.
 */
export async function hasScheduleEngagement(
  supabase: ReturnType<typeof createClient>,
  trainId: string
): Promise<boolean> {
  const [{ count: confirmedCount }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("train_participants")
      .select("id", { count: "exact", head: true })
      .eq("raid_train_id", trainId),
    supabase
      .from("train_applications")
      .select("id", { count: "exact", head: true })
      .eq("raid_train_id", trainId)
      .eq("status", "pending"),
  ]);

  return (confirmedCount ?? 0) > 0 || (pendingCount ?? 0) > 0;
}
