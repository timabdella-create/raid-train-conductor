"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CloneTrainFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} variant="secondary">
      Clone to new date
    </Button>
  );
}

export function CloneForm({
  action,
}: {
  action: (prevState: CloneTrainFormState, formData: FormData) => Promise<CloneTrainFormState>;
}) {
  const [state, formAction] = useFormState<CloneTrainFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="newEventDate">New date</Label>
        <Input id="newEventDate" name="newEventDate" type="date" required />
        {state.fieldErrors?.newEventDate && (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.newEventDate}</p>
        )}
      </div>
      <SubmitButton />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
