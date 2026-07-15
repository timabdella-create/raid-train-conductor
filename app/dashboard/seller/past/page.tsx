import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function PastTrainsPage() {
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

  const { data: history } = await supabase
    .from("seller_history")
    .select("id, raid_train_id, attendance_status, created_at")
    .eq("seller_id", sellerProfile.id)
    .order("created_at", { ascending: false });

  const trainIds = [...new Set((history ?? []).map((h) => h.raid_train_id))];
  const { data: trains } = await supabase
    .from("raid_trains")
    .select("id, name, slug, event_date")
    .in("id", trainIds.length > 0 ? trainIds : ["00000000-0000-0000-0000-000000000000"]);

  const trainById = new Map((trains ?? []).map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Past trains</h1>
        <p className="text-muted-foreground">Your participation history.</p>
      </div>

      {!history || history.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">Nothing here yet — your history builds up as trains wrap.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {history.map((h) => {
            const train = trainById.get(h.raid_train_id);
            return (
              <li key={h.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={train ? `/train/${train.slug}` : "#"} className="font-medium hover:underline">
                      {train?.name ?? "Unknown train"}
                    </Link>
                    {train && <p className="text-sm text-muted-foreground">{train.event_date}</p>}
                  </div>
                  <Badge tone="neutral">{h.attendance_status.replace(/_/g, " ")}</Badge>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
