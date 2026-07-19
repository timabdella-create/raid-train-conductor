"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateBasicProfile, type BasicProfileFormState } from "@/app/dashboard/profile/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const initialState: BasicProfileFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="w-full">
      Save changes
    </Button>
  );
}

export function BasicProfileForm({
  defaultValues,
}: {
  defaultValues: {
    displayName: string;
    phone: string | null;
    bio: string | null;
    timezone: string;
  };
}) {
  const [state, formAction] = useFormState(updateBasicProfile, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md bg-emerald-500/15 p-3 text-sm text-emerald-400">
          Profile updated.
        </p>
      )}

      <div>
        <Label htmlFor="displayName">Name</Label>
        <Input
          id="displayName"
          name="displayName"
          required
          defaultValue={defaultValues.displayName}
        />
        {state.fieldErrors?.displayName && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.displayName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={defaultValues.phone ?? undefined} />
      </div>

      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          placeholder="America/New_York"
          required
          defaultValue={defaultValues.timezone}
        />
        {state.fieldErrors?.timezone && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.timezone}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          IANA timezone name, used to show your times correctly across trains.
        </p>
      </div>

      <div>
        <Label htmlFor="bio">Bio (optional)</Label>
        <Textarea id="bio" name="bio" rows={3} defaultValue={defaultValues.bio ?? undefined} />
      </div>

      <SubmitButton />
    </form>
  );
}
