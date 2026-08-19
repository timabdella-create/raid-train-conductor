"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTrainSchema } from "@/lib/validations/train";
import { generateSlots } from "@/lib/trains/generate-slots";
import { slugify, withUniqueSuffix, generateInviteCode } from "@/lib/trains/slug";
import { parseTrainFormData } from "@/lib/trains/parse-form";
import type { Database } from "@/types/database.types";

export type TrainFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Loads the train and confirms the current user organizes it. Returns null
 * (rather than throwing) so callers can turn it into a clean form error.
 */
async function loadOwnedTrain(trainId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, train: null } as const;

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, organizer_id, status, slug")
    .eq("id", trainId)
    .maybeSingle();

  return { supabase, user, train } as const;
}

export async function updateTrain(
  trainId: string,
  _prevState: TrainFormState,
  formData: FormData
): Promise<TrainFormState> {
  const { supabase, user, train } = await loadOwnedTrain(trainId);
  if (!user) return { error: "You must be logged in." };
  if (!train) return { error: "Train not found." };

  const parsed = createTrainSchema.safeParse(parseTrainFormData(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors, error: "Please fix the highlighted fields before continuing." };
  }
  const data = parsed.data;

  // Schedule fields are locked once a train is published so shared links and
  // any (future) confirmed sellers never silently shift to a new time.
  const scheduleLocked = train.status === "published" || train.status === "live";

  const updatePayload: Database["public"]["Tables"]["raid_trains"]["Update"] = {
    name: data.name,
    description: data.description || null,
    theme: data.theme || null,
    category: data.category,
    image_url: data.imageUrl || null,
    seller_thumbnail_url: data.sellerThumbnailUrl || null,
    visibility: data.visibility,
    signup_mode: data.signupMode,
    rules: data.rules || null,
    cancellation_policy: data.cancellationPolicy || null,
    check_in_minutes_before: data.checkInMinutesBefore,
    requires_whatnot_profile: data.requiresWhatnotProfile,
    requires_show_link: data.requiresShowLink,
    sales_level_requirement: data.salesLevelRequirement || null,
    additional_questions: data.additionalQuestions,
  };

  if (data.visibility === "private") {
    const { data: existingTrain } = await supabase
      .from("raid_trains")
      .select("invite_code")
      .eq("id", trainId)
      .single();
    updatePayload.invite_code = existingTrain?.invite_code ?? generateInviteCode();
  } else {
    updatePayload.invite_code = null;
  }

  let regeneratedSlotCount: number | null = null;

  if (!scheduleLocked) {
    updatePayload.event_date = data.eventDate;
    updatePayload.start_time = `${data.startTime}:00`;
    updatePayload.end_time = `${data.endTime}:00`;
    updatePayload.timezone = data.timezone;
    updatePayload.slot_duration_minutes = data.slotDurationMinutes;
    updatePayload.break_minutes = data.breakMinutes ?? 0;

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
        fieldErrors: { endTime: "This window is too short to fit even one slot." },
        error: "Could not generate any slots.",
      };
    }

    // Draft trains have no sellers yet, so it's safe to fully replace the
    // generated slot list when the schedule changes.
    await supabase.from("train_slots").delete().eq("raid_train_id", trainId);
    const { error: slotsError } = await supabase.from("train_slots").insert(
      slots.map((s) => ({
        raid_train_id: trainId,
        start_datetime: s.startDatetime,
        end_datetime: s.endDatetime,
        position: s.position,
        status: "open" as const,
      }))
    );
    if (slotsError) {
      return { error: `Could not regenerate the schedule: ${slotsError.message}` };
    }
    regeneratedSlotCount = slots.length;
  }

  if (data.action === "publish" && train.status === "draft") {
    updatePayload.status = "published";
    updatePayload.published_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("raid_trains")
    .update(updatePayload)
    .eq("id", trainId);

  if (updateError) {
    return { error: updateError.message };
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: user.id,
    action_type: "train_updated",
    action_details: regeneratedSlotCount !== null ? { regenerated_slots: regeneratedSlotCount } : {},
  });

  revalidatePath(`/dashboard/organizer/trains/${trainId}`);
  revalidatePath("/dashboard/organizer");
  redirect(`/dashboard/organizer/trains/${trainId}`);
}

export async function setTrainStatus(trainId: string, status: "published" | "draft" | "cancelled") {
  const { supabase, user, train } = await loadOwnedTrain(trainId);
  if (!user || !train) return;

  const payload: Database["public"]["Tables"]["raid_trains"]["Update"] = { status };
  if (status === "published" && !train.status) payload.published_at = new Date().toISOString();
  if (status === "published") payload.published_at = new Date().toISOString();

  await supabase.from("raid_trains").update(payload).eq("id", trainId);
  await supabase.from("train_activity_log").insert({
    raid_train_id: trainId,
    user_id: user.id,
    action_type: `train_status_changed_${status}`,
  });

  revalidatePath(`/dashboard/organizer/trains/${trainId}`);
  revalidatePath("/dashboard/organizer");
}

export async function deleteTrain(trainId: string) {
  const { supabase, user, train } = await loadOwnedTrain(trainId);
  if (!user || !train) return;

  await supabase.from("raid_trains").delete().eq("id", trainId);
  revalidatePath("/dashboard/organizer");
  redirect("/dashboard/organizer");
}

export type CloneTrainFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function cloneTrain(
  trainId: string,
  _prevState: CloneTrainFormState,
  formData: FormData
): Promise<CloneTrainFormState> {
  const { supabase, user, train } = await loadOwnedTrain(trainId);
  if (!user) return { error: "You must be logged in." };
  if (!train) return { error: "Train not found." };

  const newDate = formData.get("newEventDate");
  if (typeof newDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return { fieldErrors: { newEventDate: "Choose a date for the new train." } };
  }

  const { data: source } = await supabase
    .from("raid_trains")
    .select("*")
    .eq("id", trainId)
    .single();

  if (!source) return { error: "Could not load the source train." };

  const base = slugify(source.name);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase.from("raid_trains").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = withUniqueSuffix(base);
  }

  let slots;
  try {
    slots = generateSlots({
      eventDate: newDate,
      startTime: source.start_time.slice(0, 5),
      endTime: source.end_time.slice(0, 5),
      timezone: source.timezone,
      slotDurationMinutes: source.slot_duration_minutes,
      breakMinutes: source.break_minutes,
    });
  } catch (e) {
    return { fieldErrors: { newEventDate: e instanceof Error ? e.message : "Invalid schedule." } };
  }

  const { data: newTrain, error: insertError } = await supabase
    .from("raid_trains")
    .insert({
      organizer_id: source.organizer_id,
      name: source.name,
      slug,
      description: source.description,
      theme: source.theme,
      category: source.category,
      image_url: source.image_url,
      event_date: newDate,
      start_time: source.start_time,
      end_time: source.end_time,
      timezone: source.timezone,
      slot_duration_minutes: source.slot_duration_minutes,
      break_minutes: source.break_minutes,
      signup_mode: source.signup_mode,
      visibility: source.visibility,
      status: "draft",
      rules: source.rules,
      cancellation_policy: source.cancellation_policy,
      check_in_minutes_before: source.check_in_minutes_before,
      requires_whatnot_profile: source.requires_whatnot_profile,
      requires_show_link: source.requires_show_link,
      sales_level_requirement: source.sales_level_requirement,
      additional_questions: source.additional_questions,
      invite_code: source.visibility === "private" ? generateInviteCode() : null,
      cloned_from_id: source.id,
    })
    .select("id")
    .single();

  if (insertError || !newTrain) {
    return { error: insertError?.message ?? "Could not clone the train." };
  }

  if (slots.length > 0) {
    await supabase.from("train_slots").insert(
      slots.map((s) => ({
        raid_train_id: newTrain.id,
        start_datetime: s.startDatetime,
        end_datetime: s.endDatetime,
        position: s.position,
        status: "open" as const,
      }))
    );
  }

  await supabase.from("train_activity_log").insert({
    raid_train_id: newTrain.id,
    user_id: user.id,
    action_type: "train_cloned",
    action_details: { cloned_from_id: source.id },
  });

  revalidatePath("/dashboard/organizer");
  redirect(`/dashboard/organizer/trains/${newTrain.id}/edit`);
}
