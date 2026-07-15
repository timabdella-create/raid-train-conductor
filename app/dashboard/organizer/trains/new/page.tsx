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

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Create a raid train</h1>
      <p className="mb-6 text-muted-foreground">
        Fill this out once — we'll build the schedule and public page for you.
      </p>
      <TrainWizard action={createTrain} />
    </div>
  );
}
