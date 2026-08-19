import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainWizard, type WizardData } from "@/components/organizer/train-wizard/train-wizard";
import { updateTrain } from "../actions";

export default async function EditTrainPage({ params }: { params: { trainId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: train } = await supabase
    .from("raid_trains")
    .select(
      "id, organizer_id, name, description, theme, category, image_url, seller_thumbnail_url, event_date, start_time, end_time, timezone, slot_duration_minutes, break_minutes, signup_mode, visibility, status, rules, cancellation_policy, check_in_minutes_before, requires_whatnot_profile, requires_show_link, sales_level_requirement, additional_questions"
    )
    .eq("id", params.trainId)
    .maybeSingle();

  if (!train) notFound();

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile || organizerProfile.id !== train.organizer_id) {
    redirect("/dashboard/organizer");
  }

  const initialData: WizardData = {
    name: train.name,
    description: train.description ?? "",
    theme: train.theme ?? "",
    category: train.category ?? "",
    imageUrl: train.image_url ?? "",
    sellerThumbnailUrl: train.seller_thumbnail_url ?? "",
    eventDate: train.event_date,
    startTime: train.start_time.slice(0, 5),
    endTime: train.end_time.slice(0, 5),
    timezone: train.timezone,
    slotDurationMinutes: String(train.slot_duration_minutes),
    breakMinutes: String(train.break_minutes),
    signupMode: train.signup_mode,
    visibility: train.visibility,
    requiresWhatnotProfile: train.requires_whatnot_profile,
    requiresShowLink: train.requires_show_link,
    salesLevelRequirement: train.sales_level_requirement ?? "",
    additionalQuestions: (train.additional_questions as string[] | null) ?? [],
    rules: train.rules ?? "",
    cancellationPolicy: train.cancellation_policy ?? "",
    checkInMinutesBefore: String(train.check_in_minutes_before),
  };

  const boundUpdateTrain = updateTrain.bind(null, train.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Edit {train.name}</h1>
      <p className="mb-6 text-muted-foreground">
        {train.status === "draft"
          ? "This train is still a draft — nothing here is public yet."
          : "This train is live. Schedule timing is locked; everything else can still change."}
      </p>
      <TrainWizard
        action={boundUpdateTrain}
        initialData={initialData}
        scheduleLocked={train.status !== "draft"}
        publishLabel={train.status === "draft" ? "Publish train" : "Save changes"}
        showDraftOption={train.status === "draft"}
      />
    </div>
  );
}
