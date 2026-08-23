import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approveGroup, rejectGroup, unrejectGroup } from "./actions";

const STATUS_TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
} as const;

export default async function AdminGroupsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: groups } = await supabase
    .from("seller_groups")
    .select("id, name, icon_url, status, created_by, created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const creatorIds = [...new Set((groups ?? []).map((g) => g.created_by))];
  const { data: creators } =
    creatorIds.length > 0
      ? await supabase.from("users").select("id, email").in("id", creatorIds)
      : { data: [] as { id: string; email: string }[] };
  const creatorEmailById = new Map((creators ?? []).map((c) => [c.id, c.email]));

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: memberRows } =
    groupIds.length > 0
      ? await supabase.from("seller_profiles").select("group_id").in("group_id", groupIds)
      : { data: [] as { group_id: string | null }[] };
  const memberCountByGroupId = new Map<string, number>();
  for (const row of memberRows ?? []) {
    if (!row.group_id) continue;
    memberCountByGroupId.set(row.group_id, (memberCountByGroupId.get(row.group_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Groups review queue</h1>
        <p className="text-muted-foreground">
          Groups work normally the moment they're created — approving isn't required for a group to function.
          Rejecting one hides it everywhere (icon, roster, join list, train tagging) until you un-reject it.
        </p>
      </div>

      {(groups ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet.</p>
      ) : (
        <ul className="space-y-3">
          {(groups ?? []).map((group) => {
            const boundApprove = approveGroup.bind(null, group.id);
            const boundReject = rejectGroup.bind(null, group.id);
            const boundUnreject = unrejectGroup.bind(null, group.id);
            return (
              <Card key={group.id}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={group.icon_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
                    />
                    <div>
                      <Link href={`/groups/${group.id}`} className="font-medium hover:underline">
                        {group.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {creatorEmailById.get(group.created_by) ?? "Unknown creator"} ·{" "}
                        {memberCountByGroupId.get(group.id) ?? 0} members
                      </p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[group.status]}>{group.status}</Badge>
                </div>
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  {group.status !== "approved" && (
                    <form action={boundApprove}>
                      <Button type="submit" className="px-3 py-1.5 text-xs">
                        Approve
                      </Button>
                    </form>
                  )}
                  {group.status !== "rejected" ? (
                    <form action={boundReject}>
                      <Button type="submit" variant="destructive" className="px-3 py-1.5 text-xs">
                        Reject
                      </Button>
                    </form>
                  ) : (
                    <form action={boundUnreject}>
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
                        Un-reject
                      </Button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
