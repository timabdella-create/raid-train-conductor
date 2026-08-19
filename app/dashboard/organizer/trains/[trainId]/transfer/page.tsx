import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransferForm } from "./transfer-form";
import { initiateTransfer, cancelTransfer } from "./actions";

export default async function TransferTrainPage({ params }: { params: { trainId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: train } = await supabase
    .from("raid_trains")
    .select("id, organizer_id, name")
    .eq("id", params.trainId)
    .maybeSingle();
  if (!train) notFound();

  const { data: organizerProfile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!organizerProfile || organizerProfile.id !== train.organizer_id) {
    redirect("/dashboard/organizer");
  }

  const { data: pendingTransfer } = await supabase
    .from("train_transfers")
    .select("id, to_email, created_at")
    .eq("raid_train_id", train.id)
    .eq("status", "pending")
    .maybeSingle();

  const boundInitiate = initiateTransfer.bind(null, train.id);
  const boundCancel = pendingTransfer ? cancelTransfer.bind(null, train.id, pendingTransfer.id) : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href={`/dashboard/organizer/trains/${train.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {train.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Transfer ownership</h1>
        <p className="text-muted-foreground">
          Hand this train off to another organizer. They'll need to accept before anything changes.
        </p>
      </div>

      {pendingTransfer ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending request</CardTitle>
            <CardDescription>
              Waiting on <span className="font-medium text-foreground">{pendingTransfer.to_email}</span> to
              accept or decline.
            </CardDescription>
          </CardHeader>
          <form action={boundCancel!}>
            <Button type="submit" variant="destructive">
              Cancel request
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Send a transfer request</CardTitle>
          </CardHeader>
          <TransferForm action={boundInitiate} />
        </Card>
      )}
    </div>
  );
}
