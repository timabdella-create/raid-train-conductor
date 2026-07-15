import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type RaidTrainRow = Database["public"]["Tables"]["raid_trains"]["Row"];
type TrainSlotRow = Database["public"]["Tables"]["train_slots"]["Row"];

export interface PublicTrainResult {
  train: RaidTrainRow;
  slots: TrainSlotRow[];
  /** True when this train was only reachable because a valid private invite code was supplied. */
  gatedByCode: boolean;
}

/**
 * Resolves a train for a public-facing page (the schedule page and the
 * apply flow both need this). Public/unlisted published trains resolve
 * through the normal RLS-respecting client. Private trains resolve only
 * when the caller supplies the correct invite code, checked server-side
 * with the service-role client — the code is never trusted from the
 * browser, and the admin client is never exposed to client code.
 */
export async function loadPublicTrain(slug: string, code?: string): Promise<PublicTrainResult | null> {
  const supabase = createClient();

  const { data: train } = await supabase.from("raid_trains").select("*").eq("slug", slug).maybeSingle();

  if (train) {
    const { data: slots } = await supabase
      .from("train_slots")
      .select("*")
      .eq("raid_train_id", train.id)
      .order("position", { ascending: true });
    return { train, slots: slots ?? [], gatedByCode: false };
  }

  if (!code) return null;

  const admin = createAdminClient();
  const { data: privateTrain } = await admin
    .from("raid_trains")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!privateTrain || privateTrain.visibility !== "private" || privateTrain.invite_code !== code) {
    return null;
  }

  const { data: slots } = await admin
    .from("train_slots")
    .select("*")
    .eq("raid_train_id", privateTrain.id)
    .order("position", { ascending: true });

  return { train: privateTrain, slots: slots ?? [], gatedByCode: true };
}
