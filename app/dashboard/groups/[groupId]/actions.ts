"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GroupAdminFormState = { error?: string; success?: string };

/** An existing group admin (creator or accepted admin) invites another user by their account email. */
export async function inviteGroupAdmin(
  groupId: string,
  _prevState: GroupAdminFormState,
  formData: FormData
): Promise<GroupAdminFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const email = formData.get("toEmail");
  if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
    return { error: "Enter their account email." };
  }

  const { error } = await supabase.rpc("invite_group_admin", {
    p_group_id: groupId,
    p_to_email: email,
  });

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/groups/${groupId}`);
  return { success: `Invite sent to ${email.trim()}.` };
}

/** Removes a group admin — works both when another admin removes someone and when they remove themselves (leave). */
export async function removeGroupAdmin(groupId: string, adminId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("remove_group_admin", { p_id: adminId });

  revalidatePath(`/dashboard/groups/${groupId}`);
}
