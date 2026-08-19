import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlotStatusBadge } from "@/components/train/status-badge";
import { CountdownTimer } from "@/components/train/countdown-timer";
import { ShareButtons } from "@/components/train/share-buttons";
import { BookmarkButton } from "@/components/train/bookmark-button";
import { BookmarkAllButton } from "@/components/train/bookmark-all-button";
import { DownloadThumbnailButton } from "@/components/train/download-thumbnail-button";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { loadPublicTrain } from "@/lib/trains/load-public-train";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type RaidTrainRow = Database["public"]["Tables"]["raid_trains"]["Row"];
type TrainSlotRow = Database["public"]["Tables"]["train_slots"]["Row"];
type SellerInfo = { whatnot_username: string; whatnot_profile_url: string; completedTrains: number };

function findLiveAndNextSlot(slots: TrainSlotRow[]) {
  const now = Date.now();
  const live = slots.find((s) => s.status === "live");
  const upcoming = slots
    .filter((s) => new Date(s.start_datetime).getTime() > now)
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())[0];
  return { live, next: upcoming };
}

export default async function PublicTrainPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { code?: string };
}) {
  const result = await loadPublicTrain(params.slug, searchParams.code);
  if (!result) notFound();

  const { train, slots, gatedByCode } = result as { train: RaidTrainRow; slots: TrainSlotRow[]; gatedByCode: boolean };
  const { live, next } = findLiveAndNextSlot(slots);
  const openCount = slots.filter((s) => s.status === "open").length;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const publicUrl = `${siteUrl}/train/${train.slug}`;

  // Seller identity for filled slots. whatnot_username/whatnot_profile_url
  // are the only seller fields readable by anonymous visitors (RLS allows
  // public select on seller_profiles for sellers on a publicly visible
  // train; the base `profiles` table — display_name — is not public).
  const sellerIds = [...new Set(slots.map((s) => s.seller_id).filter((id): id is string => !!id))];
  const sellersById = new Map<string, SellerInfo>();
  const supabase = createClient();

  const [{ data: organizerProfile }, organizerCountResult] = await Promise.all([
    supabase.from("organizer_profiles").select("organizer_name").eq("id", train.organizer_id).maybeSingle(),
    supabase.rpc("get_organizer_completed_count", { p_organizer_id: train.organizer_id }),
  ]);
  const organizerHostedCount = organizerCountResult.data ?? 0;

  if (sellerIds.length > 0) {
    const [{ data: sellerRows }, { data: sellerCounts }] = await Promise.all([
      supabase.from("seller_profiles").select("id, whatnot_username, whatnot_profile_url").in("id", sellerIds),
      supabase.rpc("get_seller_completed_counts", { p_seller_ids: sellerIds }),
    ]);
    const countBySellerId = new Map((sellerCounts ?? []).map((c) => [c.seller_id, c.completed_trains]));
    for (const row of sellerRows ?? []) {
      sellersById.set(row.id, {
        whatnot_username: row.whatnot_username,
        whatnot_profile_url: row.whatnot_profile_url,
        completedTrains: countBySellerId.get(row.id) ?? 0,
      });
    }
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <div className="relative mx-auto h-72 w-full max-w-[1600px] overflow-hidden sm:h-96 lg:h-[30rem]">
        {train.image_url ? (
          <>
            <Image
              src={train.image_url}
              alt={train.name}
              fill
              className={`object-cover ${
                train.image_position === "top"
                  ? "object-top"
                  : train.image_position === "bottom"
                    ? "object-bottom"
                    : "object-center"
              }`}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-hero-mesh" />
        )}

        {live && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
            <span className="h-2 w-2 animate-pulse-glow rounded-full bg-destructive" />
            Live now
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-4xl">
                {train.name}
              </h1>
              {gatedByCode && <Badge tone="warning">Private</Badge>}
            </div>
            <p className="mt-1 text-sm text-white/70 sm:text-base">
              {train.category}
              {train.theme && ` • ${train.theme}`}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <p className="mt-4 text-sm text-muted-foreground">
          Organized by{" "}
          <span className="font-medium text-foreground">
            {organizerProfile?.organizer_name ?? "Unknown organizer"}
          </span>{" "}
          · {organizerHostedCount} {organizerHostedCount === 1 ? "train" : "trains"} hosted
        </p>

        {train.seller_thumbnail_url && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Show thumbnail for sellers</p>
            <p className="mb-3 text-sm text-muted-foreground">
              Signed up for a slot? Grab this image and use it as your own Whatnot show thumbnail.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={train.seller_thumbnail_url}
                  alt="Show thumbnail"
                  className="h-full w-full object-cover"
                />
              </div>
              <DownloadThumbnailButton url={train.seller_thumbnail_url} trainName={train.name} />
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <BookmarkAllButton
            sellers={[...sellersById.entries()].map(([sellerId, seller]) => ({
              sellerId,
              whatnotUsername: seller.whatnot_username,
              whatnotProfileUrl: seller.whatnot_profile_url,
            }))}
            trainSlug={train.slug}
            trainName={train.name}
          />
          <div className="ml-auto flex items-center gap-4">
            <Link href="/bookmarks" className="text-sm text-muted-foreground hover:text-foreground">
              Saved shows
            </Link>
            <ShareButtons url={publicUrl} title={train.name} />
          </div>
        </div>

        {train.description && <p className="mt-2">{train.description}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4 text-sm shadow-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-medium">{train.event_date}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd className="font-medium">
              {train.start_time.slice(0, 5)}–{train.end_time.slice(0, 5)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time zone</dt>
            <dd className="font-medium">{train.timezone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Open slots</dt>
            <dd className="font-display font-semibold text-accent">{openCount}</dd>
          </div>
        </dl>

        {(live || next) && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {live && (
              <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4">
                <Badge tone="danger">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-current" />
                  Live now
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                  Slot {live.position + 1} • ends {formatSlotTime(live.end_datetime, train.timezone)}
                </p>
              </div>
            )}
            {next && (
              <div className="rounded-lg border border-border bg-card p-4">
                <Badge tone="info">Up next</Badge>
                <p className="mt-2 text-sm text-muted-foreground">
                  Slot {next.position + 1} • {formatSlotTime(next.start_datetime, train.timezone)}
                </p>
                <div className="mt-2">
                  <CountdownTimer target={next.start_datetime} label="Starts in" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Schedule</h2>
          {train.signup_mode === "invite_only" && !gatedByCode ? (
            <Badge tone="neutral">Invite only</Badge>
          ) : train.signup_mode === "waitlist_only" || openCount === 0 ? (
            <Link href={`/train/${train.slug}/apply${gatedByCode ? `?code=${searchParams.code}` : ""}`}>
              <Button variant="secondary">Join waitlist</Button>
            </Link>
          ) : (
            <Link href={`/train/${train.slug}/apply${gatedByCode ? `?code=${searchParams.code}` : ""}`}>
              <Button className="glow-accent bg-accent text-accent-foreground hover:opacity-90">
                Apply for a slot
              </Button>
            </Link>
          )}
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-border shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Seller</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => {
                const seller = slot.seller_id ? sellersById.get(slot.seller_id) : undefined;
                return (
                  <tr
                    key={slot.id}
                    className={`border-t border-border transition-colors hover:bg-muted/50 ${
                      slot.status === "live" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-muted-foreground">{slot.position + 1}</td>
                    <td className="px-4 py-2">
                      {formatSlotTime(slot.start_datetime, train.timezone)} –{" "}
                      {formatSlotTime(slot.end_datetime, train.timezone)}
                    </td>
                    <td className="px-4 py-2">
                      {seller ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={seller.whatnot_profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline"
                          >
                            @{seller.whatnot_username}
                          </a>
                          <span className="text-xs text-muted-foreground">
                            ({seller.completedTrains} {seller.completedTrains === 1 ? "train" : "trains"})
                          </span>
                          <BookmarkButton
                            sellerId={slot.seller_id as string}
                            whatnotUsername={seller.whatnot_username}
                            whatnotProfileUrl={seller.whatnot_profile_url}
                            trainSlug={train.slug}
                            trainName={train.name}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <SlotStatusBadge status={slot.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {(train.rules || train.cancellation_policy) && (
          <div className="mt-8 space-y-4">
            {train.rules && (
              <div>
                <h3 className="font-display font-semibold">Train rules</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{train.rules}</p>
              </div>
            )}
            {train.cancellation_policy && (
              <div>
                <h3 className="font-display font-semibold">Cancellation policy</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {train.cancellation_policy}
                </p>
              </div>
            )}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="hover:underline">
            Raid Train Conductor
          </Link>
        </p>
      </div>
    </main>
  );
}
