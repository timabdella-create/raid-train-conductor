import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BasicProfileForm } from "@/components/account/basic-profile-form";
import { OrganizerProfileForm } from "@/components/organizer/organizer-profile-form";
import { SellerProfileForm } from "@/components/seller/seller-profile-form";

export default async function EditProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: organizerProfile }, { data: sellerProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, phone, bio, timezone")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("organizer_profiles")
      .select("organizer_name, whatnot_username, contact_email")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("seller_profiles")
      .select("whatnot_username, whatnot_profile_url, seller_category")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit profile</h1>
        <p className="text-muted-foreground">
          Update the info shown across your organizer and seller profiles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic info</CardTitle>
          <CardDescription>Shared across everything you do on Raid Train Conductor.</CardDescription>
        </CardHeader>
        {profile && (
          <BasicProfileForm
            defaultValues={{
              displayName: profile.display_name,
              phone: profile.phone,
              bio: profile.bio,
              timezone: profile.timezone,
            }}
          />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizer profile</CardTitle>
          <CardDescription>
            {organizerProfile
              ? "Shown to sellers applying to your trains."
              : "You don't have an organizer profile yet."}
          </CardDescription>
        </CardHeader>
        {organizerProfile ? (
          <OrganizerProfileForm
            defaultValues={{
              organizerName: organizerProfile.organizer_name,
              whatnotUsername: organizerProfile.whatnot_username,
              contactEmail: organizerProfile.contact_email,
            }}
          />
        ) : (
          <Link href="/dashboard/organizer" className="text-sm font-medium text-primary hover:underline">
            + Become an organizer
          </Link>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Seller profile</CardTitle>
          <CardDescription>
            {sellerProfile
              ? "Shown to organizers reviewing your applications."
              : "You don't have a seller profile yet."}
          </CardDescription>
        </CardHeader>
        {sellerProfile ? (
          <SellerProfileForm
            defaultValues={{
              whatnotUsername: sellerProfile.whatnot_username,
              whatnotProfileUrl: sellerProfile.whatnot_profile_url,
              sellerCategory: sellerProfile.seller_category,
            }}
          />
        ) : (
          <Link href="/dashboard/seller" className="text-sm font-medium text-primary hover:underline">
            + Become a seller
          </Link>
        )}
      </Card>
    </div>
  );
}
