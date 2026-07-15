"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHECK_IN_PRESETS } from "@/lib/validations/train";
import type { WizardData } from "../train-wizard";

interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  visible: boolean;
}

export function RulesStep({ data, update, visible }: Props) {
  return (
    <div className={visible ? "space-y-4" : "hidden"}>
      <div>
        <Label htmlFor="rules">Train rules</Label>
        <Textarea
          id="rules"
          name="rules"
          value={data.rules}
          onChange={(e) => update({ rules: e.target.value })}
          placeholder="e.g. Keep your slot moving — no more than 2 minutes of dead air before handing off."
        />
      </div>

      <div>
        <Label htmlFor="cancellationPolicy">Cancellation policy</Label>
        <Textarea
          id="cancellationPolicy"
          name="cancellationPolicy"
          value={data.cancellationPolicy}
          onChange={(e) => update({ cancellationPolicy: e.target.value })}
          placeholder="e.g. Cancel at least 24 hours ahead so we can offer your slot to someone else."
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">When does check-in open?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {CHECK_IN_PRESETS.map((preset) => (
            <label
              key={preset.minutes}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="checkInMinutesBefore"
                value={preset.minutes}
                checked={Number(data.checkInMinutesBefore) === preset.minutes}
                onChange={() => update({ checkInMinutesBefore: String(preset.minutes) })}
                className="accent-primary"
              />
              {preset.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
