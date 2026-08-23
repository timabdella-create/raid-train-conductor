import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainWizard, type WizardData } from "@/components/organizer/train-wizard/train-wizard";
import { hasScheduleEngagement } from "@/lib/trains/schedule-lock";
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
      "id, organizer_id, name, description, theme, category, image_url, image_position, image_fit, seller_thumbnail_url, event_date, start_time, end_time, timezone, slot_duration_minutes, break_minutes, signup_mode, visibility, status, rules, cancellation_policy, check_in_minutes_before, requires_whatnot_profile, requires_show_link, sales_level_requirement, additional_questions, discord_webhook_url, group_id"
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

  // Groups this organizer can tag a train with: ones they created, plus
  // ones they've been added as an admin on. If this train is already
  // tagged with a group the organizer no longer admins (e.g. they were
  // removed), that group is still included so the field doesn't silently
  // show "No group" and drop the tag on next save.
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
  if (train.group_id && !groupsById.has(train.group_id)) {
    const { data: currentGroup } = await supabase
      .from("seller_groups")
      .select("id, name")
      .eq("id", train.group_id)
      .maybeSingle();
    if (currentGroup) groupsById.set(currentGroup.id, currentGroup);
  }
  const groups = [...groupsById.values()];

  const initialData: WizardData = {
    name: train.name,
    description: train.description ?? "",
    theme: train.theme ?? "",
    category: train.category ?? "",
    imageUrl: train.image_url ?? "",
    imagePosition: train.image_position ?? "center",
    imageFit: train.image_fit ?? "cover",
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
    discordWebhookUrl: train.discord_webhook_url ?? "",
    groupId: train.group_id ?? "",
  };

  const boundUpdateTrain = updateTrain.bind(null, train.id);

  // The schedule locks only once someone has actually engaged with it —
  // a confirmed seller or a pending application — not just because the
  // train is published. A live train nobody's applied to yet can still
  // have its date/time freely edited.
  const scheduleLocked = await hasScheduleEngagement(supabase, train.id);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Edit {train.name}</h1>
      <p className="mb-6 text-muted-foreground">
        {train.status === "draft"
          ? "This train is still a draft — nothing here is public yet."
          : scheduleLocked
            ? "This train is live and sellers are already confirmed or waiting on a decision, so schedule timing is locked — everything else can still change."
            : "This train is live, but nobody's confirmed or applied yet, so you can still adjust the schedule if you need to."}
      </p>
      <TrainWizard
        action={boundUpdateTrain}
        initialData={initialData}
        scheduleLocked={scheduleLocked}
        publishLabel={train.status === "draft" ? "Publish train" : "Save changes"}
        showDraftOption={train.status === "draft"}
        groups={groups}
      />
    </div>
  );
}
