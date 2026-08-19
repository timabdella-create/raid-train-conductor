import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTrainAccess } from "@/lib/trains/access";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageAllForm, MessageOneForm, type SellerOption } from "@/components/organizer/message-form";
import { QuickMessageButton } from "@/components/organizer/quick-message-button";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { messageAllSellers, messageOneSeller, sendQuickMessage } from "./actions";

export default async function MessagingPage({ params }: { params: { trainId: string } }) {
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

  const { data: participants } = await supabase
    .from("train_participants")
    .select("id, seller_id, slot_id, check_in_status")
    .eq("raid_train_id", train.id);

  const sellerIds = [...new Set((participants ?? []).map((p) => p.seller_id))];
  const { data: sellerProfiles } =
    sellerIds.length > 0
      ? await supabase.from("seller_profiles").select("id, user_id, whatnot_username").in("id", sellerIds)
      : { data: [] as { id: string; user_id: string; whatnot_username: string }[] };

  const sellerUserIds = (sellerProfiles ?? []).map((s) => s.user_id);
  const { data: displayProfiles } =
    sellerUserIds.length > 0
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", sellerUserIds)
      : { data: [] as { user_id: string; display_name: string }[] };

  const displayNameByUserId = new Map((displayProfiles ?? []).map((p) => [p.user_id, p.display_name]));
  const sellerInfoById = new Map(
    (sellerProfiles ?? []).map((s) => [
      s.id,
      { whatnotUsername: s.whatnot_username, displayName: displayNameByUserId.get(s.user_id) ?? "Seller" },
    ])
  );

  const slotIds = [...new Set((participants ?? []).map((p) => p.slot_id).filter((id): id is string => Boolean(id)))];
  const { data: slots } =
    slotIds.length > 0
      ? await supabase.from("train_slots").select("id, start_datetime").in("id", slotIds)
      : { data: [] as { id: string; start_datetime: string }[] };
  const slotById = new Map((slots ?? []).map((s) => [s.id, s]));

  const sellerOptions: SellerOption[] = (participants ?? []).map((p) => {
    const info = sellerInfoById.get(p.seller_id);
    return { sellerId: p.seller_id, label: info ? `${info.displayName} (@${info.whatnotUsername})` : "Seller" };
  });

  const boundMessageAll = messageAllSellers.bind(null, train.id);
  const boundMessageOne = messageOneSeller.bind(null, train.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/organizer/trains/${train.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {train.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Messaging</h1>
        <p className="text-muted-foreground">Email your confirmed sellers, one at a time or all at once.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message all confirmed sellers</CardTitle>
          <CardDescription>
            Sends the same email to every seller currently confirmed for a slot on this train
            ({sellerOptions.length} right now).
          </CardDescription>
        </CardHeader>
        <MessageAllForm action={boundMessageAll} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message one seller</CardTitle>
          <CardDescription>Send a one-off email to a single confirmed seller.</CardDescription>
        </CardHeader>
        {sellerOptions.length > 0 ? (
          <MessageOneForm action={boundMessageOne} sellers={sellerOptions} />
        ) : (
          <p className="text-sm text-muted-foreground">No confirmed sellers yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick sends</CardTitle>
          <CardDescription>
            One click sends a ready-made reminder, check-in notice, or "you're up next" alert to that seller.
          </CardDescription>
        </CardHeader>
        {participants && participants.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-4">Seller</th>
                  <th className="py-2 pr-4">Slot</th>
                  <th className="py-2 pr-4">Check-in</th>
                  <th className="py-2 pr-4">Quick sends</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const seller = sellerInfoById.get(p.seller_id);
                  const slot = p.slot_id ? slotById.get(p.slot_id) : undefined;
                  const boundReminder = sendQuickMessage.bind(null, train.id, p.seller_id, "reminder");
                  const boundCheckIn = sendQuickMessage.bind(null, train.id, p.seller_id, "check_in");
                  const boundNext = sendQuickMessage.bind(null, train.id, p.seller_id, "you_are_next");
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">
                        {seller ? `${seller.displayName} (@${seller.whatnotUsername})` : "Seller"}
                      </td>
                      <td className="py-2 pr-4">
                        {slot ? formatSlotTime(slot.start_datetime, train.timezone) : "—"}
                      </td>
                      <td className="py-2 pr-4 capitalize">{p.check_in_status.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <QuickMessageButton action={boundReminder} label="Reminder" />
                          <QuickMessageButton action={boundCheckIn} label="Check-in notice" />
                          <QuickMessageButton action={boundNext} label="You're next" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No confirmed sellers yet.</p>
        )}
      </Card>
    </div>
  );
}
