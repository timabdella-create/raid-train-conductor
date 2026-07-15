"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { WaitlistFormState } from "@/app/train/[slug]/apply/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="w-full">
      Join waitlist
    </Button>
  );
}

export function WaitlistForm({
  action,
}: {
  action: (prevState: WaitlistFormState, formData: FormData) => Promise<WaitlistFormState>;
}) {
  const [state, formAction] = useFormState<WaitlistFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="preferredTimes">Preferred times (optional)</Label>
        <Textarea
          id="preferredTimes"
          name="preferredTimes"
          placeholder="e.g. Anytime after 2pm, or the first hour of the train"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
