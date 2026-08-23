"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GroupStatus } from "@/types/database.types";

/** Admin-only — RLS's seller_groups_update_owner policy already restricts this to is_admin() or the group's creator, so a non-admin call here just fails silently at the database layer. */
async function setGroupStatus(groupId: string, status: GroupStatus) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("seller_groups").update({ status }).eq("id", groupId);
  revalidatePath("/dashboard/admin/groups");
}

export async function approveGroup(groupId: string) {
  await setGroupStatus(groupId, "approved");
}

export async function rejectGroup(groupId: string) {
  await setGroupStatus(groupId, "rejected");
}

export async function unrejectGroup(groupId: string) {
  await setGroupStatus(groupId, "pending");
}
