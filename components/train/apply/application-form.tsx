"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/train/countdown-timer";
import type { ApplicationFormState } from "@/app/train/[slug]/apply/actions";

interface SellerSummary {
  displayName: string;
  whatnotUsername: string;
  whatnotProfileUrl: string;
  sellerCategory: string | null;
  salesLevel: string | null;
}

interface Props {
  action: (prevState: ApplicationFormState, formData: FormData) => Promise<ApplicationFormState>;
  releaseAction: (formData: FormData) => Promise<void>;
  seller: SellerSummary;
  slotLabel: string;
  heldUntil: string;
  requiresShowLink: boolean;
  questions: string[];
  rules: string | null;
  cancellationPolicy: string | null;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="w-full">
      Submit application
    </Button>
  );
}

export function ApplicationForm({
  action,
  releaseAction,
  seller,
  slotLabel,
  heldUntil,
  requiresShowLink,
  questions,
  rules,
  cancellationPolicy,
}: Props) {
  const [state, formAction] = useFormState<ApplicationFormState, FormData>(action, {});

  return (
    <div className="space-y-6">
      <CountdownTimer target={heldUntil} label="Slot held — complete this form before" />

      <div className="rounded-md border border-border p-4">
        <p className="text-sm text-muted-foreground">Applying for</p>
        <p className="font-medium">{slotLabel}</p>
      </div>

      <div className="rounded-md border border-border p-4">
        <p className="mb-2 text-sm font-medium">Your seller info</p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd>{seller.displayName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Whatnot username</dt>
            <dd>@{seller.whatnotUsername}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{seller.sellerCategory || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sales level</dt>
            <dd>{seller.salesLevel || "—"}</dd>
          </div>
        </dl>
        <a
          href={seller.whatnotProfileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          View Whatnot profile ↗
        </a>
        <p className="mt-2 text-xs text-muted-foreground">
          Need to fix any of this?{" "}
          <a href="/dashboard/seller" className="underline">
            Edit your profile
          </a>{" "}
          in another tab, then come back — your hold stays active.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        {state.error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <div>
          <Label htmlFor="showUrl">
            Scheduled show link {requiresShowLink ? "" : "(optional)"}
          </Label>
          <Input
            id="showUrl"
            name="showUrl"
            type="url"
            placeholder="https://www.whatnot.com/live/…"
            required={requiresShowLink}
          />
          {state.fieldErrors?.showUrl && (
            <p className="mt-1 text-sm text-destructive">{state.fieldErrors.showUrl}</p>
          )}
        </div>

        {questions.map((question, i) => (
          <div key={i}>
            <Label htmlFor={`customAnswer_${i}`}>{question}</Label>
            <Input id={`customAnswer_${i}`} name={`customAnswer_${i}`} required />
            {state.fieldErrors?.customAnswers && (
              <p className="mt-1 text-sm text-destructive">{state.fieldErrors.customAnswers}</p>
            )}
          </div>
        ))}

        <div>
          <Label htmlFor="sellerNotes">Notes for the organizer (optional)</Label>
          <Textarea id="sellerNotes" name="sellerNotes" placeholder="Anything the organizer should know?" />
        </div>

        {(rules || cancellationPolicy) && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            {rules && (
              <p className="mb-1">
                <span className="font-medium text-foreground">Rules: </span>
                {rules}
              </p>
            )}
            {cancellationPolicy && (
              <p>
                <span className="font-medium text-foreground">Cancellation policy: </span>
                {cancellationPolicy}
              </p>
            )}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agreedToRules" value="true" required className="mt-0.5 accent-primary" />
          I agree to this train's rules and cancellation policy.
        </label>
        {state.fieldErrors?.agreedToRules && (
          <p className="text-sm text-destructive">{state.fieldErrors.agreedToRules}</p>
        )}

        <SubmitButton />
      </form>

      <form action={releaseAction}>
        <Button type="submit" variant="ghost" className="w-full">
          Choose a different slot
        </Button>
      </form>
    </div>
  );
}
