import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { CancelParticipationButton } from "@/components/seller/cancel-participation-button";
import { CheckInButton } from "@/components/seller/check-in-button";
import { DownloadThumbnailButton } from "@/components/train/download-thumbnail-button";
import { cancelParticipation, checkInToTrain } from "../actions";

export default async function UpcomingTrainsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sellerProfile) redirect("/dashboard/seller");

  const { data: participants } = await supabase
    .from("train_participants")
    .select("id, raid_train_id, slot_id, confirmation_status, check_in_status")
    .eq("seller_id", sellerProfile.id);

  const trainIds = [...new Set((participants ?? []).map((p) => p.raid_train_id))];
  const { data: trains } = await supabase
    .from("raid_trains")
    .select("id, name, slug, event_date, start_time, timezone, check_in_minutes_before, seller_thumbnail_url")
    .in("id", trainIds.length > 0 ? trainIds : ["00000000-0000-0000-0000-000000000000"]);

  const trainById = new Map((trains ?? []).map((t) => [t.id, t]));

  const slotIds = (participants ?? []).map((p) => p.slot_id).filter((id): id is string => Boolean(id));
  const { data: slots } =
    slotIds.length > 0
      ? await supabase.from("train_slots").select("id, start_datetime").in("id", slotIds)
      : { data: [] as { id: string; start_datetime: string }[] };
  const slotById = new Map((slots ?? []).map((s) => [s.id, s]));

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const upcoming = (participants ?? [])
    .filter((p) => {
      const train = trainById.get(p.raid_train_id);
      return train && train.event_date >= today;
    })
    .sort((a, b) => {
      const ta = trainById.get(a.raid_train_id)?.event_date ?? "";
      const tb = trainById.get(b.raid_train_id)?.event_date ?? "";
      return ta.localeCompare(tb);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upcoming trains</h1>
        <p className="text-muted-foreground">Trains you're confirmed for.</p>
      </div>

      {upcoming.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">
            No upcoming trains yet.{" "}
            <Link href="/dashboard/seller/trains" className="text-primary hover:underline">
              Browse open trains →
            </Link>
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {upcoming.map((p) => {
            const train = trainById.get(p.raid_train_id);
            if (!train) return null;
            const slot = p.slot_id ? slotById.get(p.slot_id) : null;
            const boundCancel = cancelParticipation.bind(null, train.id);
            const boundCheckIn = checkInToTrain.bind(null, p.id);

            const checkInOpensAt = slot
              ? new Date(new Date(slot.start_datetime).getTime() - train.check_in_minutes_before * 60_000)
              : null;
            const checkInOpen = checkInOpensAt ? checkInOpensAt.getTime() <= now : false;
            const alreadyCheckedIn = p.check_in_status === "checked_in";

            return (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <Link href={`/train/${train.slug}`} className="font-medium hover:underline">
                      {train.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {train.event_date} • {train.start_time.slice(0, 5)} ({train.timezone})
                      {slot && ` • Your slot: ${formatSlotTime(slot.start_datetime, train.timezone)}`}
                    </p>
                    <div className="mt-1">
                      {alreadyCheckedIn ? (
                        <Badge tone="success">Checked in ✓</Badge>
                      ) : checkInOpen ? (
                        <Badge tone="warning">Check-in open</Badge>
                      ) : (
                        <Badge tone="neutral">
                          Check-in opens {checkInOpensAt?.toLocaleString() ?? "closer to the event"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {train.seller_thumbnail_url && (
                      <DownloadThumbnailButton url={train.seller_thumbnail_url} trainName={train.name} />
                    )}
                    {!alreadyCheckedIn && checkInOpen && <CheckInButton action={boundCheckIn} />}
                    <CancelParticipationButton trainName={train.name} action={boundCancel} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
