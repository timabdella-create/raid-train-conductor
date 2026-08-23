import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainWizard } from "@/components/organizer/train-wizard/train-wizard";
import { createTrain } from "./actions";

export default async function NewTrainPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile) redirect("/dashboard/organizer");

  // Groups this organizer can tag a train with: ones they created, plus
  // ones they've been added as an admin on (0028's is_group_admin rule).
  const [{ data: createdGroups }, { data: adminRows }] = await Promise.all([
    supabase.from("seller_groups").select("id, name").eq("created_by", user.id).neq("status", "rejected"),
    supabase.from("seller_group_admins").select("group_id").eq("user_id", user.id).eq("status", "accepted"),
  ]);
  const adminGroupIds = [...new Set((adminRows ?? []).map((r) => r.group_id))];
  const { data: adminGroups } =
    adminGroupIds.length > 0
      ? await supabase.from("seller_groups").select("id, name").in("id", adminGroupIds).neq("status", "rejected")
      : { data: [] as { id: string; name: string }[] };
  const groupsById = new Map([...(createdGroups ?? []), ...(adminGroups ?? [])].map((g) => [g.id, g]));
  const groups = [...groupsById.values()];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Create a raid train</h1>
      <p className="mb-6 text-muted-foreground">
        Fill this out once — we'll build the schedule and public page for you.
      </p>
      <TrainWizard action={createTrain} groups={groups} />
    </div>
  );
}
