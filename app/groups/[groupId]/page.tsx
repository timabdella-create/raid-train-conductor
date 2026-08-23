import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function GroupRosterPage({ params }: { params: { groupId: string } }) {
  const supabase = createClient();

  const { data: group } = await supabase
    .from("seller_groups")
    .select("id, name, icon_url, created_by, status")
    .eq("id", params.groupId)
    .maybeSingle();

  // A rejected group is treated as if it doesn't exist — same as an
  // unpublished train, nothing here leaks its name or icon.
  if (!group || group.status === "rejected") notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: members }, { data: trains }, { data: adminRow }] = await Promise.all([
    supabase.rpc("get_group_members", { p_group_id: group.id }),
    // RLS on raid_trains already limits this to published public/unlisted
    // trains (or the current user's own, if they happen to be the
    // organizer) — no extra visibility filtering needed here.
    supabase
      .from("raid_trains")
      .select("id, name, slug, event_date")
      .eq("group_id", group.id)
      .order("event_date", { ascending: true }),
    user
      ? supabase
          .from("seller_group_admins")
          .select("id")
          .eq("group_id", group.id)
          .eq("user_id", user.id)
          .eq("status", "accepted")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isAdmin = Boolean(user && (group.created_by === user.id || adminRow));

  const today = new Date().toISOString().slice(0, 10);
  const upcomingTrains = (trains ?? []).filter((t) => t.event_date >= today);
  const pastTrains = (trains ?? []).filter((t) => t.event_date < today);

  // Open-slot counts, shown next to each train so visitors can tell at a
  // glance whether there's still room to join.
  const trainIds = (trains ?? []).map((t) => t.id);
  const { data: slotRows } = trainIds.length
    ? await supabase.from("train_slots").select("raid_train_id, status").in("raid_train_id", trainIds)
    : { data: [] as { raid_train_id: string; status: string }[] };
  const slotCountsByTrainId = new Map<string, { total: number; open: number }>();
  for (const row of slotRows ?? []) {
    const counts = slotCountsByTrainId.get(row.raid_train_id) ?? { total: 0, open: 0 };
    counts.total += 1;
    if (row.status === "open") counts.open += 1;
    slotCountsByTrainId.set(row.raid_train_id, counts);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to Raid Train Conductor
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={group.icon_url}
            alt=""
            className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
          />
          <div>
            <h1 className="font-display text-2xl font-bold">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              {(members ?? []).length} {(members ?? []).length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Link
            href={`/dashboard/groups/${group.id}`}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Manage group
          </Link>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Trains this group is running</h2>
        <Card>
          {upcomingTrains.length > 0 ? (
            <ul className="divide-y divide-border">
              {upcomingTrains.map((t) => {
                const counts = slotCountsByTrainId.get(t.id);
                return (
                  <li key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/train/${t.slug}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                    <div className="flex items-center gap-3">
                      {counts && counts.total > 0 && (
                        <span
                          className={
                            counts.open > 0
                              ? "text-xs font-medium text-emerald-400"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {counts.open > 0
                            ? `${counts.open} of ${counts.total} slots open`
                            : `${counts.total} slots · full`}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{t.event_date}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming trains tagged to this group yet.</p>
          )}
        </Card>
        {pastTrains.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              {pastTrains.length} past {pastTrains.length === 1 ? "train" : "trains"}
            </summary>
            <Card className="mt-2">
              <ul className="divide-y divide-border">
                {pastTrains.map((t) => {
                  const counts = slotCountsByTrainId.get(t.id);
                  return (
                    <li key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <Link href={`/train/${t.slug}`} className="font-medium hover:underline">
                        {t.name}
                      </Link>
                      <div className="flex items-center gap-3">
                        {counts && counts.total > 0 && (
                          <span className="text-xs text-muted-foreground">{counts.total} slots</span>
                        )}
                        <span className="text-xs text-muted-foreground">{t.event_date}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </details>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Members</h2>
        <Card>
          {members && members.length > 0 ? (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.seller_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <Link href={`/sellers/${m.seller_id}`} className="font-medium hover:underline">
                    @{m.whatnot_username}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nobody's joined this group yet.</p>
          )}
        </Card>
      </div>
    </main>
  );
}
