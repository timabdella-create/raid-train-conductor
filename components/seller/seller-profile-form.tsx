"use client";

import { useFormState, useFormStatus } from "react-dom";
import { saveSellerProfile, type SellerProfileFormState } from "@/app/dashboard/seller/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: SellerProfileFormState = {};

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
}: {
  defaultValues?: {
    whatnotUsername: string;
    whatnotProfileUrl: string;
    sellerCategory: string | null;
  };
}) {
  const [state, formAction] = useFormState(saveSellerProfile, initialState);
  const isEditing = !!defaultValues;

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

      <SubmitButton label={isEditing ? "Save changes" : "Save seller profile"} />
    </form>
  );
}
