import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type CurrentTrain = {
  train_id: string;
  name: string;
  slug: string;
  category: string | null;
  event_date: string;
  timezone: string;
  organizer_name: string;
};

type UpcomingTrain = CurrentTrain & { start_time: string };

export async function TrainActivity() {
  const supabase = createClient();
  const [{ data: current }, { data: upcoming }] = await Promise.all([
    supabase.rpc("get_current_trains", { p_limit: 3 }),
    supabase.rpc("get_upcoming_trains", { p_limit: 3 }),
  ]);

  const currentTrains = (current ?? []) as CurrentTrain[];
  const upcomingTrains = (upcoming ?? []) as UpcomingTrain[];

  if (currentTrains.length === 0 && upcomingTrains.length === 0) {
    return null;
  }

  return (
    <section className="bg-muted/50 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            What&apos;s happening right now
          </h2>
          <p className="mt-3 text-muted-foreground">
            A live look at raid trains running and lined up on Raid Train Conductor.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <span className="h-2.5 w-2.5 animate-pulse-glow rounded-full bg-destructive" aria-hidden="true" />
              Live now
            </h3>
            {currentTrains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing live this second — check back soon, or see what&apos;s coming up.
              </p>
            ) : (
              <ul className="space-y-3">
                {currentTrains.map((t) => (
                  <li key={t.train_id}>
                    <Link
                      href={`/train/${t.slug}`}
                      className="block rounded-md border border-border bg-card p-3 transition-shadow hover:shadow-md"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.organizer_name}
                        {t.category ? ` • ${t.category}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-electric" aria-hidden="true" />
              Coming up
            </h3>
            {upcomingTrains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming public trains scheduled yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {upcomingTrains.map((t) => (
                  <li key={t.train_id}>
                    <Link
                      href={`/train/${t.slug}`}
                      className="block rounded-md border border-border bg-background p-3 transition-shadow hover:shadow-md"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.organizer_name} • {t.event_date} {t.start_time.slice(0, 5)} ({t.timezone})
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
