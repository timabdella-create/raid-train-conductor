import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainStatusBadge } from "@/components/train/status-badge";
import type { TrainStatus } from "@/types/database.types";
import { OrganizerProfileForm } from "@/components/organizer/organizer-profile-form";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { respondToTransfer, respondToCoConductorInvite } from "./actions";
import { respondToGroupAdminInvite } from "@/lib/groups/actions";

export default async function OrganizerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // No role gate here on purpose — anyone can have an organizer profile
  // alongside a seller profile (dual-role support). If they don't have one
  // yet, the form below handles first-time setup regardless of their
  // `users.role` default.
  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id, organizer_name, whatnot_username, contact_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Set up your organizer profile</CardTitle>
            <CardDescription>
              We need a few details before you can create your first raid train.
            </CardDescription>
          </CardHeader>
          <OrganizerProfileForm />
        </Card>
      </div>
    );
  }

  const { data: trains } = await supabase
    .from("raid_trains")
    .select("id, name, slug, status, event_date, start_time, timezone, category")
    .eq("organizer_id", organizerProfile.id)
    .order("event_date", { ascending: false });

  const { data: slotCounts } = await supabase
    .from("train_slots")
    .select("raid_train_id, status")
    .in("raid_train_id", (trains ?? []).map((t) => t.id));

  const openSlotsByTrain = new Map<string, number>();
  for (const slot of slotCounts ?? []) {
    if (slot.status === "open") {
      openSlotsByTrain.set(slot.raid_train_id, (openSlotsByTrain.get(slot.raid_train_id) ?? 0) + 1);
    }
  }

  const { data: incomingTransfers } = await supabase
    .from("train_transfers")
    .select("id, raid_train_id, from_organizer_id, created_at")
    .eq("to_organizer_id", organizerProfile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const transferTrainIds = [...new Set((incomingTransfers ?? []).map((t) => t.raid_train_id))];
  const transferOrganizerIds = [...new Set((incomingTransfers ?? []).map((t) => t.from_organizer_id))];

  const { data: transferTrains } =
    transferTrainIds.length > 0
      ? await supabase.from("raid_trains").select("id, name").in("id", transferTrainIds)
      : { data: [] as { id: string; name: string }[] };
  const { data: transferSenders } =
    transferOrganizerIds.length > 0
      ? await supabase.from("organizer_profiles").select("id, organizer_name").in("id", transferOrganizerIds)
      : { data: [] as { id: string; organizer_name: string }[] };

  const trainNameById = new Map((transferTrains ?? []).map((t) => [t.id, t.name]));
  const senderNameById = new Map((transferSenders ?? []).map((o) => [o.id, o.organizer_name]));

  const { data: incomingCoConductorInvites } = await supabase
    .from("train_co_conductors")
    .select("id, raid_train_id, invited_by, created_at")
    .eq("organizer_id", organizerProfile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const { data: myCoConductorTrains } = await supabase
    .from("train_co_conductors")
    .select("id, raid_train_id, invited_by")
    .eq("organizer_id", organizerProfile.id)
    .eq("status", "accepted");

  const coConductorRelevantTrainIds = [
    ...new Set([
      ...(incomingCoConductorInvites ?? []).map((i) => i.raid_train_id),
      ...(myCoConductorTrains ?? []).map((t) => t.raid_train_id),
    ]),
  ];
  const coConductorRelevantOrganizerIds = [
    ...new Set([
      ...(incomingCoConductorInvites ?? []).map((i) => i.invited_by),
      ...(myCoConductorTrains ?? []).map((t) => t.invited_by),
    ]),
  ];

  const { data: coConductorRelevantTrains } =
    coConductorRelevantTrainIds.length > 0
      ? await supabase
          .from("raid_trains")
          .select("id, name, slug, status, event_date, start_time, timezone")
          .in("id", coConductorRelevantTrainIds)
      : { data: [] as { id: string; name: string; slug: string; status: TrainStatus; event_date: string; start_time: string; timezone: string }[] };
  const { data: coConductorRelevantOrganizers } =
    coConductorRelevantOrganizerIds.length > 0
      ? await supabase.from("organizer_profiles").select("id, organizer_name").in("id", coConductorRelevantOrganizerIds)
      : { data: [] as { id: string; organizer_name: string }[] };

  const coConductorTrainById = new Map((coConductorRelevantTrains ?? []).map((t) => [t.id, t]));
  const coConductorOwnerNameById = new Map((coConductorRelevantOrganizers ?? []).map((o) => [o.id, o.organizer_name]));

  const activeCount = trains?.filter((t) => t.status === "published" || t.status === "live").length ?? 0;
  const totalOpenSlots = [...openSlotsByTrain.values()].reduce((a, b) => a + b, 0);

  const trainIdsForCounts = (trains ?? []).map((t) => t.id);
  const { data: pendingApplications } =
    trainIdsForCounts.length > 0
      ? await supabase.from("train_applications").select("id").in("raid_train_id", trainIdsForCounts).eq("status", "pending")
      : { data: [] as { id: string }[] };
  const { data: waitlistedSellers } =
    trainIdsForCounts.length > 0
      ? await supabase.from("waitlist_entries").select("id").in("raid_train_id", trainIdsForCounts).eq("status", "waiting")
      : { data: [] as { id: string }[] };

  const { data: incomingGroupAdminInvites } = await supabase
    .from("seller_group_admins")
    .select("id, group_id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const groupAdminInviteGroupIds = [...new Set((incomingGroupAdminInvites ?? []).map((i) => i.group_id))];
  const { data: groupAdminInviteGroups } =
    groupAdminInviteGroupIds.length > 0
      ? await supabase.from("seller_groups").select("id, name").in("id", groupAdminInviteGroupIds)
      : { data: [] as { id: string; name: string }[] };
  const groupNameByInviteGroupId = new Map((groupAdminInviteGroups ?? []).map((g) => [g.id, g.name]));

  return (
    <div className="space-y-6">
      {(incomingGroupAdminInvites ?? []).length > 0 && (
        <Card className="border-primary/40 bg-primary/10">
          <CardHeader>
            <CardTitle>Incoming group admin invites</CardTitle>
            <CardDescription>Someone wants you to help admin one of their groups.</CardDescription>
          </CardHeader>
          <ul className="space-y-3">
            {(incomingGroupAdminInvites ?? []).map((invite) => {
              const acceptAction = respondToGroupAdminInvite.bind(null, invite.id, true);
              const declineAction = respondToGroupAdminInvite.bind(null, invite.id, false);
              return (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{groupNameByInviteGroupId.get(invite.group_id) ?? "A group"}</span>
                  </p>
                  <div className="flex gap-2">
                    <form action={acceptAction}>
                      <Button type="submit" className="px-3 py-1.5 text-xs">
                        Accept
                      </Button>
                    </form>
                    <form action={declineAction}>
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        Decline
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {organizerProfile.organizer_name}</h1>
          <p className="text-muted-foreground">Here's what's happening across your raid trains.</p>
        </div>
        <Link
          href="/dashboard/organizer/trains/new"
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + Create a raid train
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Active trains</p>
          <p className="text-2xl font-semibold">{activeCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Open slots</p>
          <p className="text-2xl font-semibold">{totalOpenSlots}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pending applications</p>
          <p className="text-2xl font-semibold">{pendingApplications?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Waitlisted sellers</p>
          <p className="text-2xl font-semibold">{waitlistedSellers?.length ?? 0}</p>
        </Card>
      </div>

      {(incomingTransfers ?? []).length > 0 && (
        <Card className="border-primary/40 bg-primary/10">
          <CardHeader>
            <CardTitle>Incoming transfer requests</CardTitle>
            <CardDescription>Another organizer wants to hand a train off to you.</CardDescription>
          </CardHeader>
          <ul className="space-y-3">
            {(incomingTransfers ?? []).map((transfer) => {
              const acceptAction = respondToTransfer.bind(null, transfer.id, true);
              const declineAction = respondToTransfer.bind(null, transfer.id, false);
              return (
                <li key={transfer.id} className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{trainNameById.get(transfer.raid_train_id) ?? "A raid train"}</span>{" "}
                    from <span className="font-medium">{senderNameById.get(transfer.from_organizer_id) ?? "another organizer"}</span>
                  </p>
                  <div className="flex gap-2">
                    <form action={acceptAction}>
                      <Button type="submit" className="px-3 py-1.5 text-xs">
                        Accept
                      </Button>
                    </form>
                    <form action={declineAction}>
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        Decline
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {(incomingCoConductorInvites ?? []).length > 0 && (
        <Card className="border-primary/40 bg-primary/10">
          <CardHeader>
            <CardTitle>Incoming co-conductor invites</CardTitle>
            <CardDescription>Another organizer wants your help running one of their trains.</CardDescription>
          </CardHeader>
          <ul className="space-y-3">
            {(incomingCoConductorInvites ?? []).map((invite) => {
              const acceptAction = respondToCoConductorInvite.bind(null, invite.id, true);
              const declineAction = respondToCoConductorInvite.bind(null, invite.id, false);
              return (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">{coConductorTrainById.get(invite.raid_train_id)?.name ?? "A raid train"}</span>{" "}
                    from{" "}
                    <span className="font-medium">
                      {coConductorOwnerNameById.get(invite.invited_by) ?? "another organizer"}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <form action={acceptAction}>
                      <Button type="submit" className="px-3 py-1.5 text-xs">
                        Accept
                      </Button>
                    </form>
                    <form action={declineAction}>
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        Decline
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Leaderboard />

      <Card>
        <CardHeader>
          <CardTitle>Your raid trains</CardTitle>
          <CardDescription>Manage schedules, applications, and live shows.</CardDescription>
        </CardHeader>

        {!trains || trains.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">
              You haven't created a raid train yet.
            </p>
            <Link href="/dashboard/organizer/trains/new" className="text-sm font-medium text-primary hover:underline">
              Create your first one →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {trains.map((train) => (
              <li key={train.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link
                    href={`/dashboard/organizer/trains/${train.id}`}
                    className="font-medium hover:underline"
                  >
                    {train.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {train.event_date} • {train.start_time.slice(0, 5)} ({train.timezone}) •{" "}
                    {openSlotsByTrain.get(train.id) ?? 0} open slots
                  </p>
                </div>
                <TrainStatusBadge status={train.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(myCoConductorTrains ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trains you help manage</CardTitle>
            <CardDescription>Co-conductor access — applications, schedule, waitlist, and messaging.</CardDescription>
          </CardHeader>
          <ul className="divide-y divide-border">
            {(myCoConductorTrains ?? []).map((entry) => {
              const train = coConductorTrainById.get(entry.raid_train_id);
              if (!train) return null;
              return (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/dashboard/organizer/trains/${train.id}`} className="font-medium hover:underline">
                      {train.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {train.event_date} • {train.start_time.slice(0, 5)} ({train.timezone}) • organized by{" "}
                      {coConductorOwnerNameById.get(entry.invited_by) ?? "another organizer"}
                    </p>
                  </div>
                  <TrainStatusBadge status={train.status} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
