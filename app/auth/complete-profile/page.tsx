import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { completeOAuthOnboarding } from "./actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("onboarded")
    .eq("id", user.id)
    .single();

  // Already picked a role (e.g. revisited this URL directly) — nothing left
  // to do here, so send them straight into the app.
  if (profile?.onboarded) {
    redirect("/dashboard");
  }

  async function chooseSeller() {
    "use server";
    await completeOAuthOnboarding("seller");
  }

  async function chooseOrganizer() {
    "use server";
    await completeOAuthOnboarding("organizer");
  }

  return (
    <AuthShell>
      <CardHeader>
        <CardTitle className="font-display">One more thing</CardTitle>
        <CardDescription>How are you using Raid Train Conductor?</CardDescription>
      </CardHeader>

      {searchParams.error && (
        <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </p>
      )}

      <div className="grid gap-3">
        <form action={chooseSeller}>
          <Button type="submit" className="w-full">
            I&apos;m a seller — I want to join raid trains
          </Button>
        </form>
        <form action={chooseOrganizer}>
          <Button type="submit" variant="secondary" className="w-full">
            I&apos;m an organizer — I want to run raid trains
          </Button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        You can&apos;t change this later without contacting support, so pick the one that fits.
      </p>
    </AuthShell>
  );
}
