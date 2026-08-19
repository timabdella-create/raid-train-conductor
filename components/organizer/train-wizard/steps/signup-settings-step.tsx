"use client";

import { Label } from "@/components/ui/label";
import type { WizardData } from "../train-wizard";

interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
  visible: boolean;
}

const SIGNUP_MODES = [
  { value: "open", label: "Open signup", description: "First qualified seller to claim a slot gets it." },
  { value: "approval_required", label: "Approval required", description: "Sellers request a slot; you approve or reject." },
  { value: "invite_only", label: "Invite only", description: "Sellers need your invite code to grab a slot — they're confirmed automatically." },
  { value: "waitlist_only", label: "Waitlist only", description: "The schedule is full — sellers can only join a waitlist." },
] as const;

const VISIBILITY_MODES = [
  { value: "public", label: "Public", description: "Anyone can find and view this train." },
  { value: "unlisted", label: "Unlisted", description: "Only people with the link can view it." },
  { value: "private", label: "Private", description: "Only people with an invite code can view it." },
] as const;

export function SignupSettingsStep({ data, update, errors, visible }: Props) {
  return (
    <div className={visible ? "space-y-6" : "hidden"}>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">How do sellers get a slot?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SIGNUP_MODES.map((mode) => (
            <label
              key={mode.value}
              className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="signupMode"
                  value={mode.value}
                  checked={data.signupMode === mode.value}
                  onChange={(e) => update({ signupMode: e.target.value })}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{mode.label}</span>
              </span>
              <span className="pl-6 text-xs text-muted-foreground">{mode.description}</span>
            </label>
          ))}
        </div>
        {errors.signupMode && <p className="mt-1 text-sm text-destructive">{errors.signupMode}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Who can view this train?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {VISIBILITY_MODES.map((mode) => (
            <label
              key={mode.value}
              className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value={mode.value}
                  checked={data.visibility === mode.value}
                  onChange={(e) => update({ visibility: e.target.value })}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{mode.label}</span>
              </span>
              <span className="pl-6 text-xs text-muted-foreground">{mode.description}</span>
            </label>
          ))}
        </div>
        {errors.visibility && <p className="mt-1 text-sm text-destructive">{errors.visibility}</p>}
        {data.visibility === "private" && (
          <p className="mt-2 rounded-md bg-primary/10 p-3 text-xs text-muted-foreground">
            We'll generate a private invite code when you save — share it along with the link.
          </p>
        )}
      </fieldset>

      {data.visibility !== "private" && data.signupMode === "invite_only" && (
        <p className="rounded-md bg-primary/10 p-3 text-xs text-muted-foreground">
          We'll generate an invite code when you save. Sellers who apply with it are confirmed
          automatically, no approval needed — everyone else just sees "Invite only."
        </p>
      )}
    </div>
  );
}
