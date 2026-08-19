"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CoConductorFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" isLoading={pending}>
      Send invite
    </Button>
  );
}

export function CoConductorForm({
  action,
}: {
  action: (prevState: CoConductorFormState, formData: FormData) => Promise<CoConductorFormState>;
}) {
  const [state, formAction] = useFormState<CoConductorFormState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="toEmail">Co-conductor's account email</Label>
        <Input id="toEmail" name="toEmail" type="email" placeholder="them@example.com" required />
      </div>
      <SubmitButton />
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-emerald-400">{state.success}</p>}
    </form>
  );
}
