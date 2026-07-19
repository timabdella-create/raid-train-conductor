import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { RoleSwitcher } from "@/components/nav/role-switcher";

export async function SiteHeader() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasOrganizerProfile = false;
  let hasSellerProfile = false;

  if (user) {
    const [{ data: organizerProfile }, { data: sellerProfile }] = await Promise.all([
      supabase.from("organizer_profiles").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("seller_profiles").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    hasOrganizerProfile = !!organizerProfile;
    hasSellerProfile = !!sellerProfile;
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          🚂 Raid Train Conductor
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <RoleSwitcher
                hasOrganizerProfile={hasOrganizerProfile}
                hasSellerProfile={hasSellerProfile}
              />
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
