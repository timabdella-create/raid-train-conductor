import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Landing spot after login — routes each user to the dashboard for their role.
export default async function DashboardIndexPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, onboarded")
    .eq("id", user.id)
    .single();

  // OAuth sign-ins (e.g. Google) skip the role-selection step that the
  // email/password registration form normally handles, so send them to a
  // one-time "choose your role" screen first.
  if (profile && !profile.onboarded) {
    redirect("/auth/complete-profile");
  }

  if (profile?.role === "organizer") {
    redirect("/dashboard/organizer");
  }

  // Sellers and (for now) admins land on the seller dashboard shell.
  redirect("/dashboard/seller");
}
