"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveOrganizerProfile, type OrganizerProfileFormState } from "@/app/dashboard/organizer/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: OrganizerProfileFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="w-full">
      {label}
    </Button>
  );
}

export function OrganizerProfileForm({
  defaultValues,
}: {
  defaultValues?: { organizerName: string; whatnotUsername: string | null; contactEmail: string };
}) {
  const [state, formAction] = useFormState(saveOrganizerProfile, initialState);
  const isEditing = !!defaultValues;

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div>
        <Label htmlFor="organizerName">Organizer / shop name</Label>
        <Input
          id="organizerName"
          name="organizerName"
          required
          defaultValue={defaultValues?.organizerName}
        />
        {state.fieldErrors?.organizerName && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.organizerName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="whatnotUsername">Whatnot username (optional)</Label>
        <Input
          id="whatnotUsername"
          name="whatnotUsername"
          defaultValue={defaultValues?.whatnotUsername ?? undefined}
        />
      </div>

      <div>
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input
          id="contactEmail"
          name="contactEmail"
          type="email"
          required
          defaultValue={defaultValues?.contactEmail}
        />
        {state.fieldErrors?.contactEmail && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.contactEmail}</p>
        )}
      </div>

      <SubmitButton label={isEditing ? "Save changes" : "Save organizer profile"} />
    </form>
  );
}
