import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPublicTrain } from "@/lib/trains/load-public-train";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApplicationForm } from "@/components/train/apply/application-form";
import { WaitlistForm } from "@/components/train/apply/waitlist-form";
import { holdSlot, releaseSlot, submitApplication, joinWaitlist } from "./actions";

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { code?: string; slot?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentPath = `/train/${params.slug}/apply${searchParams.code ? `?code=${searchParams.code}` : ""}`;
  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
  }

  const result = await loadPublicTrain(params.slug, searchParams.code);
  if (!result) notFound();
  const { train, slots, gatedByCode } = result;

  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("id, whatnot_username, whatnot_profile_url, seller_category, sales_level")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sellerProfile) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Complete your seller profile first</h1>
        <p className="mt-2 text-muted-foreground">
          We need your Whatnot username and profile link before you can apply to a train.
        </p>
        <Link href="/dashboard/seller" className="mt-4 inline-block text-primary hover:underline">
          Go to your profile →
        </Link>
      </main>
    );
  }

  // Already-in-progress states take priority over showing the picker again.
  const { data: participant } = await supabase
    .from("train_participants")
    .select("slot_id")
    .eq("raid_train_id", train.id)
    .eq("seller_id", sellerProfile.id)
    .maybeSingle();

  const { data: application } = await supabase
    .from("train_applications_seller_view")
    .select("status, slot_id")
    .eq("raid_train_id", train.id)
    .eq("seller_id", sellerProfile.id)
    .maybeSingle();

  const { data: waitlistEntry } = await supabase
    .from("waitlist_entries")
    .select("position, status")
    .eq("raid_train_id", train.id)
    .eq("seller_id", sellerProfile.id)
    .maybeSingle();

  async function slotLabelFor(slotId: string | null) {
    if (!slotId) return null;
    const { data: slot } = await supabase
      .from("train_slots")
      .select("start_datetime, end_datetime")
      .eq("id", slotId)
      .maybeSingle();
    if (!slot) return null;
    return `${formatSlotTime(slot.start_datetime, train.timezone)} – ${formatSlotTime(slot.end_datetime, train.timezone)}`;
  }

  if (participant) {
    const label = await slotLabelFor(participant.slot_id);
    return (
      <StatusPage title="You're confirmed!" tone="success">
        {label && <p className="text-muted-foreground">Your slot: {label}</p>}
        <Link href="/dashboard/seller/upcoming" className="mt-4 inline-block text-primary hover:underline">
          View in your dashboard →
        </Link>
      </StatusPage>
    );
  }

  if (application && application.status === "pending") {
    return (
      <StatusPage title="Application submitted" tone="warning">
        <p className="text-muted-foreground">
          Your application is waiting on the organizer's approval. We'll notify you as soon as they respond.
        </p>
        <Link href="/dashboard/seller/applications" className="mt-4 inline-block text-primary hover:underline">
          View your applications →
        </Link>
      </StatusPage>
    );
  }

  if (application && application.status === "rejected") {
    return (
      <StatusPage title="Application not approved" tone="danger">
        <p className="text-muted-foreground">
          The organizer didn't approve this application. You can check the train's other open slots.
        </p>
        <Link href={`/train/${train.slug}`} className="mt-4 inline-block text-primary hover:underline">
          Back to the train →
        </Link>
      </StatusPage>
    );
  }

  if (waitlistEntry) {
    return (
      <StatusPage title="You're on the waitlist" tone="info">
        <p className="text-muted-foreground">Position #{waitlistEntry.position}</p>
        <Link href="/dashboard/seller/waitlist" className="mt-4 inline-block text-primary hover:underline">
          View your waitlist entries →
        </Link>
      </StatusPage>
    );
  }

  const boundHoldSlot = holdSlot.bind(null, train.slug, searchParams.code);
  const boundJoinWaitlist = joinWaitlist.bind(null, train.id, train.slug);

  // Step 2: filling out the application for a slot they're currently holding.
  if (searchParams.slot) {
    const { data: heldSlot } = await supabase
      .from("train_slots")
      .select("*")
      .eq("id", searchParams.slot)
      .eq("raid_train_id", train.id)
      .maybeSingle();

    const isValidHold =
      heldSlot &&
      heldSlot.seller_id === sellerProfile.id &&
      heldSlot.status === "held" &&
      heldSlot.held_until &&
      new Date(heldSlot.held_until).getTime() > Date.now();

    if (isValidHold && heldSlot) {
      const boundSubmit = submitApplication.bind(
        null,
        train.slug,
        searchParams.code,
        heldSlot.id,
        train.requires_show_link,
        train.additional_questions.length
      );
      const boundRelease = releaseSlot.bind(null, train.slug, searchParams.code, heldSlot.id);

      return (
        <main className="mx-auto max-w-lg px-4 py-10">
          <h1 className="mb-1 text-2xl font-bold">{train.name}</h1>
          <p className="mb-6 text-muted-foreground">Finish your application</p>
          <ApplicationForm
            action={boundSubmit}
            releaseAction={boundRelease}
            seller={{
              displayName: profile?.display_name ?? "",
              whatnotUsername: sellerProfile.whatnot_username,
              whatnotProfileUrl: sellerProfile.whatnot_profile_url,
              sellerCategory: sellerProfile.seller_category,
              salesLevel: sellerProfile.sales_level,
            }}
            slotLabel={`${formatSlotTime(heldSlot.start_datetime, train.timezone)} – ${formatSlotTime(heldSlot.end_datetime, train.timezone)}`}
            heldUntil={heldSlot.held_until as string}
            requiresShowLink={train.requires_show_link}
            questions={train.additional_questions}
            rules={train.rules}
            cancellationPolicy={train.cancellation_policy}
          />
        </main>
      );
    }
    // Hold expired or invalid — fall through to the picker with a message.
  }

  await supabase.rpc("release_expired_holds_for_train", { p_train_id: train.id });
  const openSlots = slots.filter((s) => s.status === "open");

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">{train.name}</h1>
      <p className="mb-6 text-muted-foreground">
        {train.event_date} • {train.timezone}
      </p>

      {(searchParams.error || searchParams.slot) && (
        <p className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error ?? "Your hold on that slot expired — pick another one below."}
        </p>
      )}

      {train.signup_mode === "invite_only" ? (
        <StatusPage title="Invite only" tone="neutral">
          <p className="text-muted-foreground">
            This train is invite-only. Ask the organizer for an invite to join.
          </p>
        </StatusPage>
      ) : train.signup_mode === "waitlist_only" || openSlots.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{openSlots.length === 0 ? "Schedule is full" : "Waitlist only"}</CardTitle>
            <CardDescription>Join the waitlist and the organizer can offer you a slot if one opens up.</CardDescription>
          </CardHeader>
          <WaitlistForm action={boundJoinWaitlist} />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Choose a slot</CardTitle>
            <CardDescription>
              {train.signup_mode === "open"
                ? "First come, first served — claiming a slot holds it for 10 minutes while you finish the form."
                : "Claiming a slot holds it for 10 minutes while you finish the form; the organizer reviews it after."}
            </CardDescription>
          </CardHeader>
          <ul className="space-y-2">
            {openSlots.map((slot) => (
              <li key={slot.id}>
                <form action={boundHoldSlot.bind(null, slot.id)}>
                  <button
                    type="submit"
                    className="flex w-full min-h-[44px] items-center justify-between rounded-md border border-border px-4 py-3 text-left text-sm hover:border-primary hover:bg-primary/5"
                  >
                    <span>
                      {formatSlotTime(slot.start_datetime, train.timezone)} –{" "}
                      {formatSlotTime(slot.end_datetime, train.timezone)}
                    </span>
                    <span className="text-primary">Claim →</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}

function StatusPage({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <Badge tone={tone}>{title}</Badge>
      <div className="mt-3">{children}</div>
    </main>
  );
}
