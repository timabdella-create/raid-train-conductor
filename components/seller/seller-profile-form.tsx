"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveSellerProfile, type SellerProfileFormState } from "@/app/dashboard/seller/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ImageUploadField } from "@/components/organizer/image-upload-field";

const initialState: SellerProfileFormState = {};

type GroupOption = { id: string; name: string; iconUrl: string };
type GroupMode = "none" | "existing" | "new";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="w-full">
      {label}
    </Button>
  );
}

export function SellerProfileForm({
  defaultValues,
  groups,
}: {
  defaultValues?: {
    whatnotUsername: string;
    whatnotProfileUrl: string;
    sellerCategory: string | null;
    groupId: string | null;
  };
  groups: GroupOption[];
}) {
  const [state, formAction] = useFormState(saveSellerProfile, initialState);
  const isEditing = !!defaultValues;

  const [groupMode, setGroupMode] = useState<GroupMode>(defaultValues?.groupId ? "existing" : "none");
  const [existingGroupId, setExistingGroupId] = useState(defaultValues?.groupId ?? groups[0]?.id ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupIconUrl, setNewGroupIconUrl] = useState("");

  const selectedGroup = groups.find((g) => g.id === existingGroupId);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div>
        <Label htmlFor="whatnotUsername">Whatnot username</Label>
        <Input
          id="whatnotUsername"
          name="whatnotUsername"
          placeholder="@yourshop"
          required
          defaultValue={defaultValues?.whatnotUsername}
        />
        {state.fieldErrors?.whatnotUsername && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.whatnotUsername}</p>
        )}
      </div>

      <div>
        <Label htmlFor="whatnotProfileUrl">Whatnot profile URL</Label>
        <Input
          id="whatnotProfileUrl"
          name="whatnotProfileUrl"
          type="url"
          placeholder="https://www.whatnot.com/user/yourname"
          required
          defaultValue={defaultValues?.whatnotProfileUrl}
        />
        {state.fieldErrors?.whatnotProfileUrl && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.whatnotProfileUrl}</p>
        )}
      </div>

      <div>
        <Label htmlFor="sellerCategory">Category (optional)</Label>
        <Input
          id="sellerCategory"
          name="sellerCategory"
          placeholder="Plush, Trading Cards, Vintage…"
          defaultValue={defaultValues?.sellerCategory ?? undefined}
        />
      </div>

      <div className="space-y-3 rounded-md border border-border p-3">
        <div>
          <Label htmlFor="groupMode">Group / community (optional)</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            Join a group and its icon shows next to your name in the schedule table on any train you're
            signed up for. Clicking the icon shows everyone currently in that group, so it only works if
            everyone shares the same group rather than uploading their own copy of the logo.
          </p>
          <Select
            id="groupMode"
            name="groupMode"
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
          >
            <option value="none">No group</option>
            {groups.length > 0 && <option value="existing">Join an existing group</option>}
            <option value="new">Create a new group</option>
          </Select>
        </div>

        {groupMode === "existing" && (
          <div>
            <Label htmlFor="existingGroupId">Which group?</Label>
            <Select
              id="existingGroupId"
              name="existingGroupId"
              value={existingGroupId}
              onChange={(e) => setExistingGroupId(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            {selectedGroup && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedGroup.iconUrl}
                  alt=""
                  className="h-8 w-8 rounded-full border border-border object-cover"
                />
                <span className="text-sm text-muted-foreground">{selectedGroup.name}</span>
              </div>
            )}
          </div>
        )}

        {groupMode === "new" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="newGroupName">Group name</Label>
              <Input
                id="newGroupName"
                name="newGroupName"
                placeholder="e.g. Late Night Raiders"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              {state.fieldErrors?.newGroupName && (
                <p className="mt-1 text-sm text-destructive">{state.fieldErrors.newGroupName}</p>
              )}
            </div>
            <input type="hidden" name="newGroupIconUrl" value={newGroupIconUrl} />
            <ImageUploadField
              id="newGroupIconUrl"
              value={newGroupIconUrl}
              onChange={setNewGroupIconUrl}
              label="Group icon"
              helpText="Everyone who joins this group later will share this same icon."
            />
            {state.fieldErrors?.newGroupIconUrl && (
              <p className="mt-1 text-sm text-destructive">{state.fieldErrors.newGroupIconUrl}</p>
            )}
          </div>
        )}
      </div>

      <SubmitButton label={isEditing ? "Save changes" : "Save seller profile"} />
    </form>
  );
}
