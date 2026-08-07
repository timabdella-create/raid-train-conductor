import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { approveApplication, rejectApplication, addApplicationToWaitlist, moveApplicationToSlot } from "./actions";

const STATUS_TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  waitlisted: "info",
  withdrawn: "neutral",
} as const;

export default async function ApplicationsPage({ params }: { params: { trainId: string } }) {
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

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!organizerProfile || organizerProfile.id !== train.organizer_id) redirect("/dashboard/organizer");

  const { data: applications } = await supabase
    .from("train_applications")
    .select("id, slot_id, seller_id, status, seller_notes, show_url, custom_answers, created_at")
    .eq("raid_train_id", train.id)
    .order("created_at", { ascending: true });

  const sellerIds = [...new Set((applications ?? []).map((a) => a.seller_id))];
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase
          .from("seller_profiles")
          .select("id, user_id, whatnot_username, whatnot_profile_url, seller_category")
          .in("id", sellerIds)
      : { data: [] as { id: string; user_id: string; whatnot_username: string; whatnot_profile_url: string; seller_category: string | null }[] };

  const sellerUserIds = (sellerProfiles ?? []).map((s) => s.user_id);
  const { data: displayProfiles } =
    sellerUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", sellerUserIds)
      : { data: [] as { user_id: string; display_name: string }[] };

  const displayNameByUserId = new Map((displayProfiles ?? []).map((p) => [p.user_id, p.display_name]));

  const { data: sellerCounts } =
    sellerIds.length > 0
      ? await supabase.rpc("get_seller_completed_counts", { p_seller_ids: sellerIds })
      : { data: [] as { seller_id: string; completed_trains: number }[] };
  const completedCountBySellerId = new Map((sellerCounts ?? []).map((c) => [c.seller_id, c.completed_trains]));

  const sellerById = new Map(
    (sellerProfiles ?? []).map((s) => [
      s.id,
      {
        ...s,
        displayName: displayNameByUserId.get(s.user_id) ?? "Seller",
        completedTrains: completedCountBySellerId.get(s.id) ?? 0,
      },
    ])
  );

  const { data: allSlots } = await supabase
    .from("train_slots")
    .select("id, start_datetime, end_datetime, position, status")
    .eq("raid_train_id", train.id)
    .order("position", { ascending: true });

  const slotById = new Map((allSlots ?? []).map((s) => [s.id, s]));
  const openSlots = (allSlots ?? []).filter((s) => s.status === "open");

  const sortedApplications = [...(applications ?? [])].sort((a, b) => {
    const priority = { pending: 0, approved: 1, waitlisted: 2, rejected: 3, withdrawn: 4 };
    return priority[a.status] - priority[b.status];
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/organizer/trains/${train.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {train.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Applications</h1>
        <p className="text-muted-foreground">Approve, reject, reassign, or waitlist sellers who've applied.</p>
      </div>

      {sortedApplications.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">No applications yet.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {sortedApplications.map((app) => {
            const seller = sellerById.get(app.seller_id);
            const slot = app.slot_id ? slotById.get(app.slot_id) : null;
            const customAnswers = Array.isArray(app.custom_answers) ? (app.custom_answers as string[]) : [];
            const boundApprove = approveApplication.bind(null, train.id, app.id);
            const boundReject = rejectApplication.bind(null, train.id, app.id);
            const boundWaitlist = addApplicationToWaitlist.bind(null, train.id, app.id);
            const boundMove = moveApplicationToSlot.bind(null, train.id, app.id);

            return (
              <li key={app.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {seller?.displayName ?? "Seller"}{" "}
                        <span className="font-normal text-muted-foreground">@{seller?.whatnot_username}</span>{" "}
                        {seller && (
                          <span className="text-xs font-normal text-muted-foreground">
                            ({seller.completedTrains} {seller.completedTrains === 1 ? "train" : "trains"})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {seller?.seller_category ?? "—"}
                        {slot &&
                          ` • ${formatSlotTime(slot.start_datetime, train.timezone)}–${formatSlotTime(slot.end_datetime, train.timezone)}`}
                      </p>
                      {seller?.whatnot_profile_url && (
                        <a
                          href={seller.whatnot_profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View Whatnot profile ↗
                        </a>
                      )}
                    </div>
                    <Badge tone={STATUS_TONE[app.status]}>{app.status}</Badge>
                  </div>

                  {app.show_url && (
                    <p className="mt-2 text-sm">
                      Show link:{" "}
                      <a href={app.show_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {app.show_url}
                      </a>
                    </p>
                  )}
                  {app.seller_notes && <p className="mt-2 text-sm text-muted-foreground">"{app.seller_notes}"</p>}
                  {customAnswers.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      {customAnswers.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}

                  {app.status === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                      <form action={boundApprove}>
                        <Button type="submit">Approve</Button>
                      </form>
                      <form action={boundReject}>
                        <Button type="submit" variant="destructive">
                          Reject
                        </Button>
                      </form>
                      <form action={boundWaitlist}>
                        <Button type="submit" variant="secondary">
                          Move to waitlist
                        </Button>
                      </form>
                    </div>
                  )}

                  {(app.status === "pending" || app.status === "approved") && openSlots.length > 0 && (
                    <form action={boundMove} className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <select
                        name="newSlotId"
                        className="min-h-[40px] rounded-md border border-border bg-card px-2 py-1 text-sm"
                        defaultValue=""
                        required
                      >
                        <option value="" disabled>
                          Assign a different slot…
                        </option>
                        {openSlots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatSlotTime(s.start_datetime, train.timezone)} – {formatSlotTime(s.end_datetime, train.timezone)}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="secondary">
                        Move
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
