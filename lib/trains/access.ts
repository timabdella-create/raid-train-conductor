import { createClient } from "@/lib/supabase/server";

export type TrainAccess = {
  user: { id: string } | null;
  organizerProfileId: string | null;
  isOwner: boolean;
  isCoConductor: boolean;
  /** isOwner || isCoConductor — gate day-to-day management pages/actions on this. */
  canManage: boolean;
};

/**
 * Resolves whether the current user can manage a given train — either as
 * its owner or as an accepted co-conductor (see 0014_train_co_conductors.sql).
 *
 * Day-to-day operations (schedule, applications, waitlist, messaging) should
 * gate on `canManage`. Ownership-only actions — editing train details,
 * publish/unpublish, delete, transferring ownership, inviting/removing
 * co-conductors — must check `isOwner` directly; co-conductors never get
 * those, and the database enforces this independently via RLS (raid_trains
 * update/delete policies still key off owns_organizer_profile alone), so a
 * UI mistake here can't actually grant escalated access.
 */
export async function getTrainAccess(trainId: string, trainOrganizerId: string): Promise<TrainAccess> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, organizerProfileId: null, isOwner: false, isCoConductor: false, canManage: false };
  }

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile) {
    return { user, organizerProfileId: null, isOwner: false, isCoConductor: false, canManage: false };
  }

  const isOwner = organizerProfile.id === trainOrganizerId;
  let isCoConductor = false;

  if (!isOwner) {
    const { data: coRow } = await supabase
      .from("train_co_conductors")
      .select("id")
      .eq("raid_train_id", trainId)
      .eq("organizer_id", organizerProfile.id)
      .eq("status", "accepted")
      .maybeSingle();
    isCoConductor = !!coRow;
  }

  return {
    user,
    organizerProfileId: organizerProfile.id,
    isOwner,
    isCoConductor,
    canManage: isOwner || isCoConductor,
  };
}

/**
 * Server-action guard for the day-to-day management actions (applications,
 * schedule, waitlist, messaging). Throws if the current user isn't signed
 * in, the train doesn't exist, or they're neither the owner nor an accepted
 * co-conductor. Do NOT use this for ownership-only actions.
 */
export async function assertCanManageTrain(trainId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, organizer_id, name, timezone, slug")
    .eq("id", trainId)
    .maybeSingle();
  if (!train) throw new Error("Train not found.");

  const access = await getTrainAccess(trainId, train.organizer_id);
  if (!access.canManage) throw new Error("Not authorized.");

  return { supabase, userId: user.id, train };
}
