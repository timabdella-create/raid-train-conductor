import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrainAccess } from "@/lib/trains/access";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { offerSlot, removeFromWaitlist } from "./actions";

const STATUS_TONE = {
  waiting: "neutral",
  offered: "warning",
  accepted: "success",
  declined: "danger",
  expired: "danger",
  removed: "neutral",
} as const;

export default async function WaitlistManagementPage({ params }: { params: { trainId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, organizer_id, name, timezone")
    .eq("id", params.trainId)
    .maybeSingle();
  if (!train) notFound();

  const access = await getTrainAccess(train.id, train.organizer_id);
  if (!access.canManage) redirect("/dashboard/organizer");

  await supabase.rpc("release_expired_waitlist_offers_for_train", { p_train_id: train.id });

  const { data: entries } = await supabase
    .from("waitlist_entries")
    .select("id, seller_id, preferred_times, position, status, offered_slot_id, offer_expires_at")
    .eq("raid_train_id", train.id)
    .order("position", { ascending: true });

  const sellerIds = [...new Set((entries ?? []).map((e) => e.seller_id))];
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("seller_profiles").select("id, user_id, whatnot_username, seller_category").in("id", sellerIds)
      : { data: [] as { id: string; user_id: string; whatnot_username: string; seller_category: string | null }[] };

  const sellerUserIds = (sellerProfiles ?? []).map((s) => s.user_id);
  const { data: displayProfiles } =
    sellerUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", sellerUserIds)
      : { data: [] as { user_id: string; display_name: string }[] };

  const displayNameByUserId = new Map((displayProfiles ?? []).map((p) => [p.user_id, p.display_name]));
  const sellerById = new Map(
    (sellerProfiles ?? []).map((s) => [s.id, { ...s, displayName: displayNameByUserId.get(s.user_id) ?? "Seller" }])
  );

  const { data: openSlots } = await supabase
    .from("train_slots")
    .select("id, start_datetime, end_datetime")
    .eq("raid_train_id", train.id)
    .eq("status", "open")
    .order("position", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/organizer/trains/${train.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {train.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Waitlist</h1>
        <p className="text-muted-foreground">Offer open slots to waitlisted sellers in order.</p>
      </div>

      {!entries || entries.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">No one's on the waitlist right now.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const seller = sellerById.get(entry.seller_id);
            const boundOffer = offerSlot.bind(null, train.id, entry.id);
            const boundRemove = removeFromWaitlist.bind(null, train.id, entry.id);

            return (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        #{entry.position} — {seller?.displayName ?? "Seller"}{" "}
                        <span className="font-normal text-muted-foreground">@{seller?.whatnot_username}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{seller?.seller_category ?? "—"}</p>
                      {entry.preferred_times && (
                        <p className="mt-1 text-sm text-muted-foreground">Preferred: {entry.preferred_times}</p>
                      )}
                    </div>
                    <Badge tone={STATUS_TONE[entry.status]}>{entry.status}</Badge>
                  </div>

                  {entry.status === "waiting" && openSlots && openSlots.length > 0 && (
                    <form action={boundOffer} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <select
                        name="slotId"
                        className="min-h-[40px] rounded-md border border-border bg-card px-2 py-1 text-sm"
                        defaultValue=""
                        required
                      >
                        <option value="" disabled>
                          Offer which slot?
                        </option>
                        {openSlots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatSlotTime(s.start_datetime, train.timezone)} – {formatSlotTime(s.end_datetime, train.timezone)}
                          </option>
                        ))}
                      </select>
                      <Button type="submit">Offer slot</Button>
                    </form>
                  )}
                  {entry.status === "waiting" && (!openSlots || openSlots.length === 0) && (
                    <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">
                      No open slots to offer right now.
                    </p>
                  )}

                  {entry.status === "offered" && entry.offer_expires_at && (
                    <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                      Waiting on their response — offer expires{" "}
                      {new Date(entry.offer_expires_at).toLocaleString()}.
                    </p>
                  )}

                  {(entry.status === "waiting" || entry.status === "offered") && (
                    <form action={boundRemove} className="mt-2">
                      <Button type="submit" variant="ghost" className="text-destructive">
                        Remove from waitlist
                      </Button>
                    </form>
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
