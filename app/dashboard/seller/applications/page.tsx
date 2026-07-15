import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  waitlisted: "info",
  withdrawn: "neutral",
} as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: { applied?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sellerProfile) redirect("/dashboard/seller");

  const { data: applications } = await supabase
    .from("train_applications_seller_view")
    .select("id, raid_train_id, status, show_url, created_at")
    .eq("seller_id", sellerProfile.id)
    .order("created_at", { ascending: false });

  const trainIds = [...new Set((applications ?? []).map((a) => a.raid_train_id))];
  const { data: trains } = await supabase
    .from("raid_trains")
    .select("id, name, slug, event_date, start_time, timezone")
    .in("id", trainIds.length > 0 ? trainIds : ["00000000-0000-0000-0000-000000000000"]);

  const trainById = new Map((trains ?? []).map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your applications</h1>
        <p className="text-muted-foreground">Track approval status for trains you've applied to.</p>
      </div>

      {searchParams.applied && (
        <p className="rounded-md bg-primary/10 p-3 text-sm">Application submitted — good luck!</p>
      )}

      {!applications || applications.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">
            You haven't applied to any trains yet.{" "}
            <Link href="/dashboard/seller/trains" className="text-primary hover:underline">
              Browse open trains →
            </Link>
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {applications.map((app) => {
            const train = trainById.get(app.raid_train_id);
            return (
              <li key={app.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={train ? `/train/${train.slug}` : "#"} className="font-medium hover:underline">
                      {train?.name ?? "Unknown train"}
                    </Link>
                    {train && (
                      <p className="text-sm text-muted-foreground">
                        {train.event_date} • {train.start_time.slice(0, 5)} ({train.timezone})
                      </p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[app.status]}>{app.status}</Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
