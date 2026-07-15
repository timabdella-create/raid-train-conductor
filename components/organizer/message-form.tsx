"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { MessageFormState } from "@/app/dashboard/organizer/trains/[trainId]/messaging/actions";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      {children}
    </Button>
  );
}

type Action = (prevState: MessageFormState, formData: FormData) => Promise<MessageFormState>;

export function MessageAllForm({ action }: { action: Action }) {
  const [state, formAction] = useFormState<MessageFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="all-subject">Subject</Label>
        <Input id="all-subject" name="subject" placeholder="Reminder about tomorrow's train" required />
      </div>
      <div>
        <Label htmlFor="all-message">Message</Label>
        <Textarea id="all-message" name="message" placeholder="Write what you want everyone confirmed to know…" required />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Email all confirmed sellers</SubmitButton>
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}

export interface SellerOption {
  sellerId: string;
  label: string;
}

export function MessageOneForm({ action, sellers }: { action: Action; sellers: SellerOption[] }) {
  const [state, formAction] = useFormState<MessageFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="one-seller">Seller</Label>
        <Select id="one-seller" name="sellerId" required defaultValue="">
          <option value="" disabled>
            Choose a seller…
          </option>
          {sellers.map((s) => (
            <option key={s.sellerId} value={s.sellerId}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="one-subject">Subject</Label>
        <Input id="one-subject" name="subject" placeholder="Quick question about your show link" required />
      </div>
      <div>
        <Label htmlFor="one-message">Message</Label>
        <Textarea id="one-message" name="message" required />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>Send</SubmitButton>
        {state.success && <p className="text-sm text-green-700">{state.success}</p>}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}
