"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTrainSchema } from "@/lib/validations/train";
import { slugify, withUniqueSuffix, generateInviteCode } from "@/lib/trains/slug";
import { generateSlots } from "@/lib/trains/generate-slots";
import { parseTrainFormData } from "@/lib/trains/parse-form";

export type TrainFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createTrain(
  _prevState: TrainFormState,
  formData: FormData
): Promise<TrainFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile) {
    return { error: "Complete your organizer profile before creating a train." };
  }

  const parsed = createTrainSchema.safeParse(parseTrainFormData(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors, error: "Please fix the highlighted fields before continuing." };
  }

  const data = parsed.data;

  // Generate a unique slug for the public URL, retrying with a short suffix
  // on collision rather than failing the whole submission.
  const base = slugify(data.name);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("raid_trains")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = withUniqueSuffix(base);
  }

  const inviteCode = data.visibility === "private" ? generateInviteCode() : null;

  let slots;
  try {
    slots = generateSlots({
      eventDate: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      timezone: data.timezone,
      slotDurationMinutes: data.slotDurationMinutes,
      breakMinutes: data.breakMinutes,
    });
  } catch (e) {
    return {
      fieldErrors: { endTime: e instanceof Error ? e.message : "Invalid schedule." },
      error: "Could not generate the schedule from these times.",
    };
  }

  if (slots.length === 0) {
    return {
      fieldErrors: {
        endTime: "This window is too short to fit even one slot. Widen it or shorten the slot length.",
      },
      error: "Could not generate any slots.",
    };
  }

  const { data: train, error: insertError } = await supabase
    .from("raid_trains")
    .insert({
      organizer_id: organizerProfile.id,
      name: data.name,
      slug,
      description: data.description || null,
      theme: data.theme || null,
      category: data.category,
      image_url: data.imageUrl || null,
      event_date: data.eventDate,
      start_time: `${data.startTime}:00`,
      end_time: `${data.endTime}:00`,
      timezone: data.timezone,
      slot_duration_minutes: data.slotDurationMinutes,
      break_minutes: data.breakMinutes ?? 0,
      signup_mode: data.signupMode,
      visibility: data.visibility,
      status: data.action === "publish" ? "published" : "draft",
      rules: data.rules || null,
      cancellation_policy: data.cancellationPolicy || null,
      check_in_minutes_before: data.checkInMinutesBefore,
      requires_whatnot_profile: data.requiresWhatnotProfile,
      requires_show_link: data.requiresShowLink,
      sales_level_requirement: data.salesLevelRequirement || null,
      additional_questions: data.additionalQuestions,
      invite_code: inviteCode,
      published_at: data.action === "publish" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (insertError || !train) {
    return { error: insertError?.message ?? "Could not create the train." };
  }

  const { error: slotsError } = await supabase.from("train_slots").insert(
    slots.map((s) => ({
      raid_train_id: train.id,
      start_datetime: s.startDatetime,
      end_datetime: s.endDatetime,
      position: s.position,
      status: "open" as const,
    }))
  );

  if (slotsError) {
    return { error: `Train saved, but the schedule failed to generate: ${slotsError.message}` };
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: train.id,
    user_id: user.id,
    action_type: data.action === "publish" ? "train_published" : "train_created_draft",
    action_details: { slot_count: slots.length },
  });

  revalidatePath("/dashboard/organizer");
  redirect(`/dashboard/organizer/trains/${train.id}`);
}
