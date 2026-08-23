import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: counts }, { data: group }] = await Promise.all([
    supabase.rpc("get_seller_completed_counts", { p_seller_ids: [seller.id] }),
    seller.group_id
      ? supabase.from("seller_groups").select("id, name, icon_url").eq("id", seller.group_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const completedTrains = counts?.[0]?.completed_trains ?? 0;

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
    </main>
  );
}
