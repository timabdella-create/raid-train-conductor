import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TRAIN_CATEGORIES } from "@/lib/validations/train";

export default async function BrowseTrainsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let query = supabase
    .from("raid_trains")
    .select("id, name, slug, category, theme, event_date, start_time, timezone, signup_mode, image_url")
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .gte("event_date", new Date().toISOString().slice(0, 10))
    .order("event_date", { ascending: true });

  if (searchParams.q) {
    query = query.ilike("name", `%${searchParams.q}%`);
  }
  if (searchParams.category) {
    query = query.eq("category", searchParams.category);
  }

  const { data: trains } = await query;

  const { data: slotCounts } = await supabase
    .from("train_slots")
    .select("raid_train_id, status")
    .in("raid_train_id", (trains ?? []).map((t) => t.id));

  const openByTrain = new Map<string, number>();
  for (const s of slotCounts ?? []) {
    if (s.status === "open") openByTrain.set(s.raid_train_id, (openByTrain.get(s.raid_train_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse raid trains</h1>
        <p className="text-muted-foreground">Find an upcoming train and claim a slot.</p>
      </div>

      <form className="flex flex-wrap gap-3">
        <Input name="q" placeholder="Search by name…" defaultValue={searchParams.q} className="max-w-xs" />
        <select
          name="category"
          defaultValue={searchParams.category ?? ""}
          className="min-h-[44px] rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {TRAIN_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>

      {!trains || trains.length === 0 ? (
        <p className="text-muted-foreground">No upcoming trains match that search.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trains.map((train) => (
            <Link key={train.id} href={`/train/${train.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                {train.image_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={train.image_url}
                    alt={train.name}
                    className="mb-3 h-32 w-full rounded-md object-cover"
                  />
                )}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{train.name}</h2>
                  <Badge tone={(openByTrain.get(train.id) ?? 0) > 0 ? "success" : "neutral"}>
                    {(openByTrain.get(train.id) ?? 0) > 0 ? `${openByTrain.get(train.id)} open` : "Full"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {train.category}
                  {train.theme && ` • ${train.theme}`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {train.event_date} • {train.start_time.slice(0, 5)} ({train.timezone})
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
