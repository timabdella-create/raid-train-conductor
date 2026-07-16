import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainStatusBadge, SlotStatusBadge } from "@/components/train/status-badge";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { setTrainStatus, deleteTrain, cloneTrain } from "./actions";
import { CloneForm } from "./clone-form";

export default async function TrainOverviewPage({ params }: { params: { trainId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: train } = await supabase
    .from("raid_trains")
    .select(
      "id, organizer_id, name, slug, status, visibility, event_date, start_time, end_time, timezone, invite_code, category, theme, image_url, requires_show_link"
    )
    .eq("id", params.trainId)
    .maybeSingle();

  if (!train) notFound();

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile || organizerProfile.id !== train.organizer_id) {
    redirect("/dashboard/organizer");
  }

  const { data: slots } = await supabase
    .from("train_slots")
    .select("id, start_datetime, end_datetime, position, status, seller_id")
    .eq("raid_train_id", train.id)
    .order("position", { ascending: true });

  const sellerIds = [...new Set((slots ?? []).map((s) => s.seller_id).filter((id): id is string => Boolean(id)))];

  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("seller_profiles").select("id, user_id, whatnot_username").in("id", sellerIds)
      : { data: [] as { id: string; user_id: string; whatnot_username: string }[] };

  const sellerUserIds = (sellerProfiles ?? []).map((s) => s.user_id);
  const { data: sellerDisplayProfiles } =
    sellerUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", sellerUserIds)
      : { data: [] as { user_id: string; display_name: string }[] };

  const displayNameByUserId = new Map((sellerDisplayProfiles ?? []).map((p) => [p.user_id, p.display_name]));
  const sellerInfoById = new Map(
    (sellerProfiles ?? []).map((s) => [
      s.id,
      { whatnotUsername: s.whatnot_username, displayName: displayNameByUserId.get(s.user_id) ?? "Seller" },
    ])
  );

  const { data: pendingApplications } = await supabase
    .from("train_applications")
    .select("id")
    .eq("raid_train_id", train.id)
    .eq("status", "pending");

  const { data: waitlistCount } = await supabase
    .from("waitlist_entries")
    .select("id")
    .eq("raid_train_id", train.id)
    .eq("status", "waiting");

  const { data: participants } = await supabase
    .from("train_participants")
    .select("id, show_url")
    .eq("raid_train_id", train.id);

  const missingShowLink = train.requires_show_link
    ? (participants ?? []).filter((p) => !p.show_url).length
    : 0;
  const missingThumbnail = train.image_url ? 0 : 1;
  const missingInfoTotal = missingShowLink + missingThumbnail + (pendingApplications?.length ?? 0);

  const openCount = slots?.filter((s) => s.status === "open").length ?? 0;
  const filledCount = (slots?.length ?? 0) - openCount;
  const publicUrl = `/train/${train.slug}`;

  const publishAction = setTrainStatus.bind(null, train.id, "published");
  const unpublishAction = setTrainStatus.bind(null, train.id, "draft");
  const cancelAction = setTrainStatus.bind(null, train.id, "cancelled");
  const deleteAction = deleteTrain.bind(null, train.id);
  const boundCloneTrain = cloneTrain.bind(null, train.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold">{train.name}</h1>
            <TrainStatusBadge status={train.status} />
          </div>
          <p className="text-muted-foreground">
            {train.event_date} • {train.start_time.slice(0, 5)}–{train.end_time.slice(0, 5)} ({train.timezone})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/organizer/trains/${train.id}/schedule`}>
            <Button>Schedule manager</Button>
          </Link>
          <Link href={`/dashboard/organizer/trains/${train.id}/applications`}>
            <Button variant="secondary">Applications</Button>
          </Link>
          <Link href={`/dashboard/organizer/trains/${train.id}/waitlist`}>
            <Button variant="secondary">Waitlist</Button>
          </Link>
          <Link href={`/dashboard/organizer/trains/${train.id}/messaging`}>
            <Button variant="secondary">Messaging</Button>
          </Link>
          <Link href={`/dashboard/organizer/trains/${train.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          {train.visibility !== "private" || train.status === "published" ? (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">View public page</Button>
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total slots</p>
          <p className="text-2xl font-semibold">{slots?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Filled</p>
          <p className="text-2xl font-semibold">{filledCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Open</p>
          <p className="text-2xl font-semibold">{openCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pending applications</p>
          <p className="text-2xl font-semibold">{pendingApplications?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Waitlisted</p>
          <p className="text-2xl font-semibold">{waitlistCount?.length ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Visibility</p>
          <p className="text-2xl font-semibold capitalize">{train.visibility}</p>
        </Card>
      </div>

      {missingInfoTotal > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <p className="mb-2 text-sm font-semibold">Missing information ({missingInfoTotal})</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {missingThumbnail > 0 && (
              <li>
                No train thumbnail —{" "}
                <Link href={`/dashboard/organizer/trains/${train.id}/edit`} className="text-primary hover:underline">
                  add one
                </Link>
              </li>
            )}
            {(pendingApplications?.length ?? 0) > 0 && (
              <li>
                {pendingApplications?.length} application{pendingApplications?.length === 1 ? "" : "s"} awaiting your review —{" "}
                <Link href={`/dashboard/organizer/trains/${train.id}/applications`} className="text-primary hover:underline">
                  review now
                </Link>
              </li>
            )}
            {missingShowLink > 0 && (
              <li>
                {missingShowLink} confirmed seller{missingShowLink === 1 ? "" : "s"} missing a show link
              </li>
            )}
          </ul>
        </Card>
      )}

      {train.visibility === "private" && train.invite_code && (
        <Card className="p-4">
          <p className="text-sm font-medium">Invite code</p>
          <p className="text-muted-foreground">
            Share <code className="rounded bg-muted px-1.5 py-0.5">{train.invite_code}</code> along with
            the link — private trains need both to view.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Publishing, pausing, cloning, and deleting this train.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          {train.status === "draft" && (
            <form action={publishAction}>
              <Button type="submit">Publish</Button>
            </form>
          )}
          {train.status === "published" && (
            <form action={unpublishAction}>
              <Button type="submit" variant="secondary">
                Unpublish (back to draft)
              </Button>
            </form>
          )}
          {(train.status === "published" || train.status === "draft") && (
            <form action={cancelAction}>
              <Button type="submit" variant="destructive">
                Cancel train
              </Button>
            </form>
          )}
          <form action={deleteAction}>
            <Button type="submit" variant="destructive">
              Delete permanently
            </Button>
          </form>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">Clone this train to a new date</p>
          <CloneForm action={boundCloneTrain} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>
            Drag-and-drop reordering, approvals, and replacements land in Phase 4. Sellers who've
            claimed or been confirmed for a slot already show up here.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Seller</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {slots?.map((slot) => {
                const seller = slot.seller_id ? sellerInfoById.get(slot.seller_id) : null;
                return (
                  <tr key={slot.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground">{slot.position + 1}</td>
                    <td className="py-2 pr-4">
                      {formatSlotTime(slot.start_datetime, train.timezone)} –{" "}
                      {formatSlotTime(slot.end_datetime, train.timezone)}
                    </td>
                    <td className="py-2 pr-4">
                      {seller ? `${seller.displayName} (@${seller.whatnotUsername})` : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <SlotStatusBadge status={slot.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
