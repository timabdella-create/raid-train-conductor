"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { TransferFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Send transfer request
    </Button>
  );
}

export function TransferForm({
  action,
}: {
  action: (prevState: TransferFormState, formData: FormData) => Promise<TransferFormState>;
}) {
  const [state, formAction] = useFormState<TransferFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="toEmail">Recipient's account email</Label>
        <Input id="toEmail" name="toEmail" type="email" placeholder="them@example.com" required />
        <p className="mt-1 text-xs text-muted-foreground">
          They need an existing organizer account on Raid Train Conductor. Nothing changes until
          they accept the request.
        </p>
      </div>
      <SubmitButton />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-400">{state.success}</p>}
    </form>
  );
}
