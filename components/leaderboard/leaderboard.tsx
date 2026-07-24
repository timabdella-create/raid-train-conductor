import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TopOrganizer = { organizer_id: string; organizer_name: string; completed_trains: number };
type TopSeller = {
  seller_id: string;
  display_name: string;
  whatnot_username: string | null;
  completed_trains: number;
};

const RANK_STYLES = [
  "border-accent/50 bg-accent/10 text-accent", // #1
  "border-electric/50 bg-electric/10 text-electric", // #2
  "border-muted-foreground/30 bg-muted text-muted-foreground", // #3
];

function RankedList({
  items,
  variant,
}: {
  items: { key: string; primary: string; secondary?: string | null; count: number }[];
  variant: "public" | "compact";
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No completed trains yet — this list fills in as trains wrap up.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li
          key={item.key}
          className={cn(
            "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
            variant === "public" ? RANK_STYLES[i] : "border-border bg-background"
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                variant === "public" ? "bg-black/10" : RANK_STYLES[i]
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.primary}</p>
              {item.secondary && (
                <p className="truncate text-xs text-muted-foreground">{item.secondary}</p>
              )}
            </div>
          </div>
          <span className="shrink-0 font-display text-sm font-semibold">
            {item.count} <span className="font-normal text-muted-foreground">trains</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export async function Leaderboard({ variant = "compact" }: { variant?: "public" | "compact" }) {
  const supabase = createClient();
  const [{ data: organizers }, { data: sellers }] = await Promise.all([
    supabase.rpc("get_top_organizers", { p_limit: 3 }),
    supabase.rpc("get_top_sellers", { p_limit: 3 }),
  ]);

  const topOrganizers = (organizers ?? []) as TopOrganizer[];
  const topSellers = (sellers ?? []) as TopSeller[];

  if (topOrganizers.length === 0 && topSellers.length === 0) {
    return null;
  }

  const organizerItems = topOrganizers.map((o) => ({
    key: o.organizer_id,
    primary: o.organizer_name,
    count: o.completed_trains,
  }));
  const sellerItems = topSellers.map((s) => ({
    key: s.seller_id,
    primary: s.display_name,
    secondary: s.whatnot_username ? `@${s.whatnot_username}` : null,
    count: s.completed_trains,
  }));

  if (variant === "compact") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" aria-hidden="true" />
            Leaderboard
          </CardTitle>
          <CardDescription>Top organizers and sellers by completed trains.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Top organizers
            </p>
            <RankedList items={organizerItems} variant="compact" />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Top sellers
            </p>
            <RankedList items={sellerItems} variant="compact" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The leaderboard
          </h2>
          <p className="mt-3 text-muted-foreground">
            The organizers and sellers getting the most raid trains across the finish line.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Trophy className="h-5 w-5 text-accent" aria-hidden="true" />
              Top organizers
            </h3>
            <RankedList items={organizerItems} variant="public" />
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Trophy className="h-5 w-5 text-electric" aria-hidden="true" />
              Top sellers
            </h3>
            <RankedList items={sellerItems} variant="public" />
          </div>
        </div>
      </div>
    </section>
  );
}
