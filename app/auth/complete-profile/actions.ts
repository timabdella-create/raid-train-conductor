"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database.types";

export async function completeOAuthOnboarding(role: UserRole) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("complete_oauth_onboarding", { p_role: role });

  if (error) {
    redirect(`/auth/complete-profile?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
