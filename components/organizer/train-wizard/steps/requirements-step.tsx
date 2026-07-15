"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxField } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { WizardData } from "../train-wizard";

interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  visible: boolean;
}

export function RequirementsStep({ data, update, visible }: Props) {
  const [questionDraft, setQuestionDraft] = useState("");

  function addQuestion() {
    const trimmed = questionDraft.trim();
    if (!trimmed || data.additionalQuestions.length >= 5) return;
    update({ additionalQuestions: [...data.additionalQuestions, trimmed] });
    setQuestionDraft("");
  }

  function removeQuestion(index: number) {
    update({ additionalQuestions: data.additionalQuestions.filter((_, i) => i !== index) });
  }

  return (
    <div className={visible ? "space-y-4" : "hidden"}>
      <CheckboxField
        id="requiresWhatnotProfile"
        name="requiresWhatnotProfile"
        value="true"
        label="Require a Whatnot profile link"
        description="Sellers must provide a valid Whatnot profile URL to apply."
        checked={data.requiresWhatnotProfile}
        onChange={(e) => update({ requiresWhatnotProfile: e.target.checked })}
      />
      <CheckboxField
        id="requiresShowLink"
        name="requiresShowLink"
        value="true"
        label="Require a scheduled show link"
        description="Sellers must link their scheduled Whatnot show before check-in."
        checked={data.requiresShowLink}
        onChange={(e) => update({ requiresShowLink: e.target.checked })}
      />

      <div>
        <Label htmlFor="salesLevelRequirement">Sales-level requirement (optional)</Label>
        <Input
          id="salesLevelRequirement"
          name="salesLevelRequirement"
          value={data.salesLevelRequirement}
          onChange={(e) => update({ salesLevelRequirement: e.target.value })}
          placeholder="e.g. 100+ completed sales"
        />
      </div>

      <div>
        <Label htmlFor="questionDraft">Additional questions (optional, up to 5)</Label>
        <div className="flex gap-2">
          <Input
            id="questionDraft"
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            placeholder="e.g. What will you be selling?"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addQuestion();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addQuestion}>
            Add
          </Button>
        </div>
        {data.additionalQuestions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {data.additionalQuestions.map((q, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                {q}
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove question: ${q}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input type="hidden" name="additionalQuestions" value={JSON.stringify(data.additionalQuestions)} />
    </div>
  );
}
