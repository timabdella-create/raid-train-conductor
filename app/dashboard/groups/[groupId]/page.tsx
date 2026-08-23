import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroupAdminForm } from "./group-admin-form";
import { inviteGroupAdmin, removeGroupAdmin } from "./actions";

export default async function ManageGroupPage({ params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase
    .from("seller_groups")
    .select("id, name, icon_url, created_by, status")
    .eq("id", params.groupId)
    .maybeSingle();
  if (!group) notFound();

  const { data: adminRow } = await supabase
    .from("seller_group_admins")
    .select("id")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  const isAdmin = group.created_by === user.id || Boolean(adminRow);
  if (!isAdmin) redirect(`/groups/${group.id}`);

  const [{ data: creator }, { data: admins }] = await Promise.all([
    supabase.from("users").select("email").eq("id", group.created_by).maybeSingle(),
    supabase
      .from("seller_group_admins")
      .select("id, to_email, status, user_id")
      .eq("group_id", group.id)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: true }),
  ]);

  const boundInvite = inviteGroupAdmin.bind(null, group.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/groups/${group.id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to {group.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Manage {group.name}</h1>
        <p className="text-muted-foreground">
          Admins can tag trains they organize as run by this group.
          {group.status === "pending" && " This group is still awaiting admin review — it's fully usable in the meantime."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
          <CardDescription>Anyone here can invite more admins or tag their trains with this group.</CardDescription>
        </CardHeader>
        <ul className="space-y-3">
          <li className="flex items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium">{creator?.email ?? "Group creator"}</span>
            </p>
            <Badge tone="neutral">Creator</Badge>
          </li>
          {(admins ?? []).map((admin) => {
            const boundRemove = removeGroupAdmin.bind(null, group.id, admin.id);
            return (
              <li key={admin.id} className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  <span className="font-medium">{admin.to_email}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Badge tone={admin.status === "accepted" ? "success" : "warning"}>
                    {admin.status === "accepted" ? "Admin" : "Invite pending"}
                  </Badge>
                  <form action={boundRemove}>
                    <Button type="submit" variant="ghost" className="min-h-0 px-2 py-1 text-xs text-destructive">
                      Remove
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite an admin</CardTitle>
          <CardDescription>They'll need an existing Raid Train Conductor account with this email.</CardDescription>
        </CardHeader>
        <GroupAdminForm action={boundInvite} />
      </Card>
    </div>
  );
}
