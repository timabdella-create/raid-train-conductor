"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const organizerProfileSchema = z.object({
  organizerName: z.string().trim().min(2, "Organizer name must be at least 2 characters.").max(80),
  whatnotUsername: z.string().trim().max(50).optional().or(z.literal("")),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid contact email."),
});

export type OrganizerProfileFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Handles both first-time setup and later edits: upserting on the
// user_id unique constraint means an existing profile gets updated in
// place (same row, same id) rather than duplicated.
export async function saveOrganizerProfile(
  _prevState: OrganizerProfileFormState,
  formData: FormData
): Promise<OrganizerProfileFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const parsed = organizerProfileSchema.safeParse({
    organizerName: formData.get("organizerName"),
    whatnotUsername: formData.get("whatnotUsername"),
    contactEmail: formData.get("contactEmail"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { error } = await supabase.from("organizer_profiles").upsert(
    {
      user_id: user.id,
      organizer_name: parsed.data.organizerName,
      whatnot_username: parsed.data.whatnotUsername || null,
      contact_email: parsed.data.contactEmail,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/organizer");
  revalidatePath("/dashboard/profile");
  return {};
}
