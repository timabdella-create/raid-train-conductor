import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { WaitlistOfferActions } from "@/components/seller/waitlist-offer-actions";
import { acceptWaitlistOffer, declineWaitlistOffer } from "../actions";

export default async function WaitlistPage({ searchParams }: { searchParams: { joined?: string } }) {
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

  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select("id, raid_train_id, position, status, offered_slot_id, offer_expires_at, created_at")
    .eq("seller_id", sellerProfile.id)
    .order("created_at", { ascending: false });

  const trainIds = [...new Set((entries ?? []).map((e) => e.raid_train_id))];
  const { data: trains } = await supabase
    .from("raid_trains")
    .select("id, name, slug, event_date, start_time, timezone")
    .in("id", trainIds.length > 0 ? trainIds : ["00000000-0000-0000-0000-000000000000"]);

  const trainById = new Map((trains ?? []).map((t) => [t.id, t]));

  const offeredSlotIds = (entries ?? [])
    .map((e) => e.offered_slot_id)
    .filter((id): id is string => Boolean(id));
  const { data: offeredSlots } =
    offeredSlotIds.length > 0
      ? await supabase.from("train_slots").select("id, start_datetime, end_datetime").in("id", offeredSlotIds)
      : { data: [] as { id: string; start_datetime: string; end_datetime: string }[] };
  const slotById = new Map((offeredSlots ?? []).map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your waitlist entries</h1>
        <p className="text-muted-foreground">The organizer can offer you a slot manually if one opens up.</p>
      </div>

      {searchParams.joined && (
        <p className="rounded-md bg-primary/10 p-3 text-sm">You've joined the waitlist.</p>
      )}

      {!entries || entries.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">You're not on any waitlists right now.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const train = trainById.get(entry.raid_train_id);
            const offeredSlot = entry.offered_slot_id ? slotById.get(entry.offered_slot_id) : null;
            const boundAccept = acceptWaitlistOffer.bind(null, entry.id);
            const boundDecline = declineWaitlistOffer.bind(null, entry.id);

            return (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link href={train ? `/train/${train.slug}` : "#"} className="font-medium hover:underline">
                        {train?.name ?? "Unknown train"}
                      </Link>
                      {train && (
                        <p className="text-sm text-muted-foreground">
                          {train.event_date} • {train.start_time.slice(0, 5)} ({train.timezone})
                        </p>
                      )}
                    </div>
                    <Badge tone="info">#{entry.position} in line</Badge>
                  </div>

                  {entry.status === "offered" && offeredSlot && train && (
                    <div className="mt-3 rounded-md bg-primary/10 p-3">
                      <p className="text-sm font-medium">
                        You've been offered{" "}
                        {formatSlotTime(offeredSlot.start_datetime, train.timezone)} –{" "}
                        {formatSlotTime(offeredSlot.end_datetime, train.timezone)}
                      </p>
                      {entry.offer_expires_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Respond by {new Date(entry.offer_expires_at).toLocaleString()}
                        </p>
                      )}
                      <div className="mt-3">
                        <WaitlistOfferActions onAccept={boundAccept} onDecline={boundDecline} />
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
