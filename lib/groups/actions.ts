"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Invited user accepts or declines a group-admin invite. Shared by both the organizer and seller dashboards, since group membership isn't tied to either role. */
export async function respondToGroupAdminInvite(inviteId: string, accept: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("respond_to_group_admin_invite", { p_invite_id: inviteId, p_accept: accept });
  revalidatePath("/dashboard/organizer");
  revalidatePath("/dashboard/seller");
}
