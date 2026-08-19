"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildApplicationSchema, waitlistJoinSchema } from "@/lib/validations/application";
import { sendNotification } from "@/lib/notifications/send";
import { formatSlotTime } from "@/lib/trains/generate-slots";

function applyPath(slug: string, code?: string, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (code) params.set("code", code);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  const qs = params.toString();
  return `/train/${slug}/apply${qs ? `?${qs}` : ""}`;
}

export async function holdSlot(slug: string, code: string | undefined, slotId: string, _formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(applyPath(slug, code))}`);
  }

  const { error } = await supabase.rpc("hold_train_slot", { p_slot_id: slotId, p_hold_minutes: 10 });

  if (error) {
    redirect(applyPath(slug, code, { error: error.message }));
  }

  redirect(applyPath(slug, code, { slot: slotId }));
}

export async function releaseSlot(slug: string, code: string | undefined, slotId: string, _formData: FormData) {
  const supabase = createClient();
  await supabase.rpc("release_train_slot", { p_slot_id: slotId });
  redirect(applyPath(slug, code));
}

export type ApplicationFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function submitApplication(
  slug: string,
  code: string | undefined,
  slotId: string,
  requiresShowLink: boolean,
  questionCount: number,
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const schema = buildApplicationSchema({ requiresShowLink, questionCount });

  const customAnswers: string[] = [];
  for (let i = 0; i < questionCount; i++) {
    customAnswers.push(String(formData.get(`customAnswer_${i}`) ?? ""));
  }

  const parsed = schema.safeParse({
    showUrl: formData.get("showUrl"),
    sellerNotes: formData.get("sellerNotes"),
    customAnswers,
    agreedToRules: formData.get("agreedToRules"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: application, error } = await supabase.rpc("submit_train_application", {
    p_slot_id: slotId,
    p_seller_notes: parsed.data.sellerNotes || null,
    p_show_url: parsed.data.showUrl || null,
    p_custom_answers: parsed.data.customAnswers,
    p_invite_code: code || null,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, name, timezone")
    .eq("slug", slug)
    .maybeSingle();
  const { data: slot } = await supabase
    .from("train_slots")
    .select("start_datetime, end_datetime")
    .eq("id", slotId)
    .maybeSingle();

  if (train) {
    await sendNotification({
      userId: user.id,
      raidTrainId: train.id,
      type: "signup_confirmation",
      data: {
        trainName: train.name,
        pending: application?.status === "pending",
        slotTime: slot ? formatSlotTime(slot.start_datetime, train.timezone) : undefined,
      },
    });
  }

  redirect(`/dashboard/seller/applications?applied=${slug}`);
}

export type WaitlistFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function joinWaitlist(
  trainId: string,
  slug: string,
  _prevState: WaitlistFormState,
  formData: FormData
): Promise<WaitlistFormState> {
  const parsed = waitlistJoinSchema.safeParse({ preferredTimes: formData.get("preferredTimes") });
  if (!parsed.success) {
    return { error: "Please check the form and try again." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: entry, error } = await supabase.rpc("join_train_waitlist", {
    p_train_id: trainId,
    p_preferred_times: parsed.data.preferredTimes || null,
  });

  if (error) {
    return { error: error.message };
  }

  const { data: train } = await supabase.from("raid_trains").select("name").eq("id", trainId).maybeSingle();
  if (train) {
    await sendNotification({
      userId: user.id,
      raidTrainId: trainId,
      type: "added_to_waitlist",
      data: { trainName: train.name, position: entry?.position },
    });
  }

  redirect(`/dashboard/seller/waitlist?joined=${slug}`);
}
