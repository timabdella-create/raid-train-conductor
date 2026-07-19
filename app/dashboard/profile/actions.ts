"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const basicProfileSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  timezone: z.string().trim().min(1, "Enter a timezone.").max(60),
});

export type BasicProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

export async function updateBasicProfile(
  _prevState: BasicProfileFormState,
  formData: FormData
): Promise<BasicProfileFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const parsed = basicProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    phone: formData.get("phone"),
    bio: formData.get("bio"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      phone: parsed.data.phone || null,
      bio: parsed.data.bio || null,
      timezone: parsed.data.timezone,
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/profile");
  return { success: true };
}
