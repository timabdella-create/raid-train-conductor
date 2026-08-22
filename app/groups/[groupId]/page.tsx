import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function GroupRosterPage({ params }: { params: { groupId: string } }) {
  const supabase = createClient();

  const { data: group } = await supabase
    .from("seller_groups")
    .select("id, name, icon_url")
    .eq("id", params.groupId)
    .maybeSingle();

  if (!group) notFound();

  const { data: members } = await supabase.rpc("get_group_members", { p_group_id: group.id });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to Raid Train Conductor
      </Link>

      <div className="mt-4 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={group.icon_url}
          alt=""
          className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
        />
        <div>
          <h1 className="font-display text-2xl font-bold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {(members ?? []).length} {(members ?? []).length === 1 ? "member" : "members"}
          </p>
        </div>
      </div>

      <Card className="mt-6">
        {members && members.length > 0 ? (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.seller_id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <a
                  href={m.whatnot_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                >
                  @{m.whatnot_username}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody's joined this group yet.</p>
        )}
      </Card>
    </main>
  );
}
