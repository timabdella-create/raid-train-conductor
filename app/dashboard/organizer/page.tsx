import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrainStatusBadge } from "@/components/train/status-badge";
import { OrganizerProfileForm } from "@/components/organizer/organizer-profile-form";
import { Leaderboard } from "@/components/leaderboard/leaderboard";

export default async function OrganizerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userRow } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (userRow?.role !== "organizer" && userRow?.role !== "admin") {
    redirect("/dashboard/seller");
  }

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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
