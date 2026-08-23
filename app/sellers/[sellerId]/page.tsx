import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatSlotTime } from "@/lib/trains/generate-slots";

export default async function SellerProfilePage({ params }: { params: { sellerId: string } }) {
  const supabase = createClient();

  // RLS only exposes a seller's row here if they currently hold a slot or
  // participant spot on a train that's publicly visible — same rule that
  // already governs their name showing up on a train's schedule table.
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, whatnot_username, whatnot_profile_url, seller_category, group_id")
    .eq("id", params.sellerId)
    .maybeSingle();

  if (!seller) notFound();

  const [{ data: counts }, { data: group }, { data: participants }] = await Promise.all([
    supabase.rpc("get_seller_completed_counts", { p_seller_ids: [seller.id] }),
    seller.group_id
      ? supabase.from("seller_groups").select("id, name, icon_url").eq("id", seller.group_id).neq("status", "rejected").maybeSingle()
      : Promise.resolve({ data: null }),
    // train_participants' public RLS only returns rows on publicly-visible
    // trains, so this list naturally excludes anything unpublished/private
    // without needing an extra filter here.
    supabase.from("train_participants").select("raid_train_id, slot_id").eq("seller_id", seller.id),
  ]);
  const completedTrains = counts?.[0]?.completed_trains ?? 0;

  const trainIds = [...new Set((participants ?? []).map((p) => p.raid_train_id))];
  const { data: trains } =
    trainIds.length > 0
      ? await supabase
          .from("raid_trains")
          .select("id, name, slug, event_date, timezone, image_url, image_fit, image_position")
          .in("id", trainIds)
      : {
          data: [] as {
            id: string;
            name: string;
            slug: string;
            event_date: string;
            timezone: string;
            image_url: string | null;
            image_fit: string;
            image_position: string;
          }[],
        };
  const trainById = new Map((trains ?? []).map((t) => [t.id, t]));

  const slotIds = (participants ?? []).map((p) => p.slot_id).filter((id): id is string => Boolean(id));
  const { data: slots } =
    slotIds.length > 0
      ? await supabase.from("train_slots").select("id, start_datetime").in("id", slotIds)
      : { data: [] as { id: string; start_datetime: string }[] };
  const slotById = new Map((slots ?? []).map((s) => [s.id, s]));

  const today = new Date().toISOString().slice(0, 10);
  type UpcomingRow = {
    train: {
      id: string;
      name: string;
      slug: string;
      event_date: string;
      timezone: string;
      image_url: string | null;
      image_fit: string;
      image_position: string;
    };
    slotStart: string | null;
  };
  const upcomingTrains: UpcomingRow[] = [];
  for (const p of participants ?? []) {
    const train = trainById.get(p.raid_train_id);
    if (!train || train.event_date < today) continue;
    const slotStart = p.slot_id ? (slotById.get(p.slot_id)?.start_datetime ?? null) : null;
    upcomingTrains.push({ train, slotStart });
  }
  upcomingTrains.sort((a, b) => a.train.event_date.localeCompare(b.train.event_date));

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to Raid Train Conductor
      </Link>

      <Card className="mt-4">
        <div className="flex items-center gap-4">
          {group && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.icon_url}
              alt=""
              className="h-16 w-16 shrink-0 rounded-full border border-border object-cover"
            />
          )}
          <div>
            <h1 className="font-display text-2xl font-bold">@{seller.whatnot_username}</h1>
            <p className="text-sm text-muted-foreground">
              {completedTrains} {completedTrains === 1 ? "train" : "trains"} completed
              {seller.seller_category ? ` · ${seller.seller_category}` : ""}
            </p>
          </div>
        </div>

        {group && (
          <Link
            href={`/groups/${group.id}`}
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {group.name} →
          </Link>
        )}

        <a
          href={seller.whatnot_profile_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/70"
        >
          View Whatnot profile ↗
        </a>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold">Upcoming trains</h2>
        {upcomingTrains.length > 0 ? (
          <ul className="divide-y divide-border">
            {upcomingTrains.map(({ train, slotStart }) => {
              const positionClass =
                train.image_position === "top"
                  ? "object-top"
                  : train.image_position === "bottom"
                    ? "object-bottom"
                    : "object-center";
              return (
                <li key={train.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/train/${train.slug}`} className="font-medium hover:underline">
                    {train.name}
                  </Link>
                  {train.image_url && (
                    <Link
                      href={`/train/${train.slug}`}
                      className="mt-2 block overflow-hidden rounded-md border border-border"
                    >
                      <div className="relative h-32 w-full">
                        <Image
                          src={train.image_url}
                          alt=""
                          fill
                          className={`object-cover ${positionClass}`}
                        />
                      </div>
                    </Link>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {train.event_date}
                    {slotStart ? ` · ${formatSlotTime(slotStart, train.timezone)}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming trains.</p>
        )}
      </Card>
    </main>
  );
}
