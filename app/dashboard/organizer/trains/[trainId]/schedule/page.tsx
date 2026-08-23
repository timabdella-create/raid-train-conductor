import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrainAccess } from "@/lib/trains/access";
import { ScheduleManager, type ScheduleSlot } from "@/components/organizer/schedule-manager";
import {
  swapSlotSellers,
  removeSellerFromSlot,
  toggleSlotAvailability,
  checkInSellerManually,
  undoCheckIn,
} from "./actions";

export default async function ScheduleManagerPage({ params }: { params: { trainId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, organizer_id, name, timezone, check_in_minutes_before")
    .eq("id", params.trainId)
    .maybeSingle();
  if (!train) notFound();

  const access = await getTrainAccess(train.id, train.organizer_id);
  if (!access.canManage) redirect("/dashboard/organizer");

  const { data: slots } = await supabase
    .from("train_slots")
    .select("id, start_datetime, end_datetime, status, seller_id, position")
    .eq("raid_train_id", train.id)
    .order("position", { ascending: true });

  const sellerIds = [...new Set((slots ?? []).map((s) => s.seller_id).filter((id): id is string => Boolean(id)))];
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("seller_profiles").select("id, user_id, whatnot_username, group_id").in("id", sellerIds)
      : { data: [] as { id: string; user_id: string; whatnot_username: string; group_id: string | null }[] };

  const sellerUserIds = (sellerProfiles ?? []).map((s) => s.user_id);
  const groupIds = [...new Set((sellerProfiles ?? []).map((s) => s.group_id).filter((id): id is string => Boolean(id)))];
  const [{ data: displayProfiles }, { data: groupRows }] = await Promise.all([
    sellerUserIds.length > 0
      ? supabase.from("profiles").select("user_id, display_name").in("user_id", sellerUserIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
    groupIds.length > 0
      ? supabase.from("seller_groups").select("id, name, icon_url").in("id", groupIds).neq("status", "rejected")
      : Promise.resolve({ data: [] as { id: string; name: string; icon_url: string }[] }),
  ]);

  const displayNameByUserId = new Map((displayProfiles ?? []).map((p) => [p.user_id, p.display_name]));
  const groupById = new Map((groupRows ?? []).map((g) => [g.id, { id: g.id, name: g.name, iconUrl: g.icon_url }]));
  const sellerInfoById = new Map(
    (sellerProfiles ?? []).map((s) => [
      s.id,
      {
        whatnotUsername: s.whatnot_username,
        displayName: displayNameByUserId.get(s.user_id) ?? "Seller",
        group: s.group_id ? (groupById.get(s.group_id) ?? null) : null,
      },
    ])
  );

  const { data: participants } = await supabase
    .from("train_participants")
    .select("seller_id, check_in_status")
    .eq("raid_train_id", train.id);
  const checkInStatusBySeller = new Map((participants ?? []).map((p) => [p.seller_id, p.check_in_status]));

  const now = Date.now();
  const scheduleSlots: ScheduleSlot[] = (slots ?? []).map((s) => {
    const checkInOpensAt = new Date(s.start_datetime).getTime() - train.check_in_minutes_before * 60_000;
    return {
      id: s.id,
      startDatetime: s.start_datetime,
      endDatetime: s.end_datetime,
      status: s.status,
      seller: s.seller_id ? (sellerInfoById.get(s.seller_id) ?? null) : null,
      checkedIn: s.seller_id ? checkInStatusBySeller.get(s.seller_id) === "checked_in" : false,
      checkInOpen: checkInOpensAt <= now,
    };
  });

  const boundSwap = swapSlotSellers.bind(null, train.id);
  const boundRemove = removeSellerFromSlot.bind(null, train.id);
  const boundToggle = toggleSlotAvailability.bind(null, train.id);
  const boundCheckIn = checkInSellerManually.bind(null, train.id);
  const boundUndoCheckIn = undoCheckIn.bind(null, train.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/organizer/trains/${train.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {train.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Schedule manager</h1>
        <p className="text-muted-foreground">Rearrange the lineup, remove a seller, or take a slot out of rotation.</p>
      </div>

      <ScheduleManager
        timezone={train.timezone}
        slots={scheduleSlots}
        onSwap={boundSwap}
        onRemoveSeller={boundRemove}
        onToggleAvailability={boundToggle}
        onCheckIn={boundCheckIn}
        onUndoCheckIn={boundUndoCheckIn}
      />
    </div>
  );
}
