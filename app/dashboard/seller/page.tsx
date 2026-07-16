import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SellerProfileForm } from "@/components/seller/seller-profile-form";
import { Leaderboard } from "@/components/leaderboard/leaderboard";

export default async function SellerDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .single();

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("id, whatnot_username, whatnot_profile_url, seller_category")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sellerProfile) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Complete your seller profile</CardTitle>
            <CardDescription>
              Organizers need your Whatnot info to confirm you for a slot.
            </CardDescription>
          </CardHeader>
          <SellerProfileForm />
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: participants }, { data: pendingApps }, { data: waitlistEntries }] = await Promise.all([
    supabase.from("train_participants").select("raid_train_id").eq("seller_id", sellerProfile.id),
    supabase
      .from("train_applications_seller_view")
      .select("id")
      .eq("seller_id", sellerProfile.id)
      .eq("status", "pending"),
    supabase.from("waitlist_entries").select("id").eq("seller_id", sellerProfile.id).eq("status", "waiting"),
  ]);

  const trainIds = [...new Set((participants ?? []).map((p) => p.raid_train_id))];
  const { data: trains } =
    trainIds.length > 0
      ? await supabase.from("raid_trains").select("id, event_date").in("id", trainIds)
      : { data: [] as { id: string; event_date: string }[] };
  const upcomingCount = (trains ?? []).filter((t) => t.event_date >= today).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile?.display_name}</h1>
          <p className="text-muted-foreground">@{sellerProfile.whatnot_username} on Whatnot</p>
        </div>
        <Link href="/dashboard/seller/trains">
          <Button>Browse raid trains</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Link href="/dashboard/seller/upcoming">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-sm text-muted-foreground">Upcoming trains</p>
            <p className="text-2xl font-semibold">{upcomingCount}</p>
          </Card>
        </Link>
        <Link href="/dashboard/seller/applications">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-sm text-muted-foreground">Pending applications</p>
            <p className="text-2xl font-semibold">{pendingApps?.length ?? 0}</p>
          </Card>
        </Link>
        <Link href="/dashboard/seller/waitlist">
          <Card className="p-4 transition-shadow hover:shadow-md">
            <p className="text-sm text-muted-foreground">Waitlisted</p>
            <p className="text-2xl font-semibold">{waitlistEntries?.length ?? 0}</p>
          </Card>
        </Link>
      </div>

      <Leaderboard />

      <Card>
        <CardHeader>
          <CardTitle>Quick links</CardTitle>
          <CardDescription>Everything about your raid train activity.</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/seller/trains">
            <Button variant="secondary">Browse open trains</Button>
          </Link>
          <Link href="/dashboard/seller/applications">
            <Button variant="secondary">My applications</Button>
          </Link>
          <Link href="/dashboard/seller/waitlist">
            <Button variant="secondary">My waitlist entries</Button>
          </Link>
          <Link href="/dashboard/seller/upcoming">
            <Button variant="secondary">Upcoming trains</Button>
          </Link>
          <Link href="/dashboard/seller/past">
            <Button variant="secondary">Past trains</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
