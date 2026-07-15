"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createOrganizerProfile, type OrganizerProfileFormState } from "@/app/dashboard/organizer/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: OrganizerProfileFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="w-full">
      Save organizer profile
    </Button>
  );
}

export function OrganizerProfileForm() {
  const [state, formAction] = useFormState(createOrganizerProfile, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div>
        <Label htmlFor="organizerName">Organizer / shop name</Label>
        <Input id="organizerName" name="organizerName" required />
        {state.fieldErrors?.organizerName && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.organizerName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="whatnotUsername">Whatnot username (optional)</Label>
        <Input id="whatnotUsername" name="whatnotUsername" placeholder="@yourshop" />
      </div>

      <div>
        <Label htmlFor="contactEmail">Contact email</Label>
        <Input id="contactEmail" name="contactEmail" type="email" required />
        {state.fieldErrors?.contactEmail && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.contactEmail}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
