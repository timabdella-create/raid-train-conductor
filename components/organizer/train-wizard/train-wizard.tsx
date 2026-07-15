"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  basicDetailsSchema,
  scheduleSchema,
  signupSettingsSchema,
} from "@/lib/validations/train";
import { Button } from "@/components/ui/button";
import { WizardProgress } from "./wizard-progress";
import { BasicDetailsStep } from "./steps/basic-details-step";
import { ScheduleStep } from "./steps/schedule-step";
import { SignupSettingsStep } from "./steps/signup-settings-step";
import { RequirementsStep } from "./steps/requirements-step";
import { RulesStep } from "./steps/rules-step";
import { ReviewStep } from "./steps/review-step";

export interface WizardData {
  name: string;
  description: string;
  theme: string;
  category: string;
  imageUrl: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  slotDurationMinutes: string;
  breakMinutes: string;
  signupMode: string;
  visibility: string;
  requiresWhatnotProfile: boolean;
  requiresShowLink: boolean;
  salesLevelRequirement: string;
  additionalQuestions: string[];
  rules: string;
  cancellationPolicy: string;
  checkInMinutesBefore: string;
}

export const EMPTY_WIZARD_DATA: WizardData = {
  name: "",
  description: "",
  theme: "",
  category: "",
  imageUrl: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  timezone: "America/New_York",
  slotDurationMinutes: "20",
  breakMinutes: "0",
  signupMode: "open",
  visibility: "public",
  requiresWhatnotProfile: true,
  requiresShowLink: true,
  salesLevelRequirement: "",
  additionalQuestions: [],
  rules: "",
  cancellationPolicy: "",
  checkInMinutesBefore: "120",
};

type FormState = { error?: string; fieldErrors?: Record<string, string> };

interface TrainWizardProps {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
  initialData?: WizardData;
  scheduleLocked?: boolean;
  publishLabel?: string;
  showDraftOption?: boolean;
}

function SubmitButtons({ showDraftOption, publishLabel }: { showDraftOption: boolean; publishLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-3">
      {showDraftOption && (
        <Button type="submit" name="action" value="draft" variant="secondary" isLoading={pending}>
          Save as draft
        </Button>
      )}
      <Button type="submit" name="action" value="publish" isLoading={pending}>
        {publishLabel}
      </Button>
    </div>
  );
}

export function TrainWizard({
  action,
  initialData,
  scheduleLocked = false,
  publishLabel = "Publish train",
  showDraftOption = true,
}: TrainWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData ?? EMPTY_WIZARD_DATA);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [state, formAction] = useFormState<FormState, FormData>(action, {});

  function update(patch: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  function validateCurrentStep(): boolean {
    let result;
    if (step === 1) {
      result = basicDetailsSchema.safeParse(data);
    } else if (step === 2) {
      result = scheduleSchema.safeParse({
        ...data,
        slotDurationMinutes: Number(data.slotDurationMinutes),
        breakMinutes: Number(data.breakMinutes || 0),
      });
    } else if (step === 3) {
      result = signupSettingsSchema.safeParse(data);
    } else {
      setStepErrors({});
      return true;
    }

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) errors[String(issue.path[0])] = issue.message;
      setStepErrors(errors);
      return false;
    }
    setStepErrors({});
    return true;
  }

  function goNext() {
    if (validateCurrentStep()) setStep((s) => Math.min(s + 1, 6));
  }

  function goBack() {
    setStepErrors({});
    setStep((s) => Math.max(s - 1, 1));
  }

  const combinedErrors = { ...stepErrors, ...(state.fieldErrors ?? {}) };

  return (
    <div>
      <WizardProgress currentStep={step} />

      <form action={formAction} noValidate>
        {state.error && (
          <p role="alert" className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <BasicDetailsStep data={data} update={update} errors={combinedErrors} visible={step === 1} />
        <ScheduleStep
          data={data}
          update={update}
          errors={combinedErrors}
          visible={step === 2}
          locked={scheduleLocked}
        />
        <SignupSettingsStep data={data} update={update} errors={combinedErrors} visible={step === 3} />
        <RequirementsStep data={data} update={update} visible={step === 4} />
        <RulesStep data={data} update={update} visible={step === 5} />
        <ReviewStep data={data} visible={step === 6} />

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1}>
            Back
          </Button>

          {step < 6 ? (
            <Button type="button" onClick={goNext}>
              Next
            </Button>
          ) : (
            <SubmitButtons showDraftOption={showDraftOption} publishLabel={publishLabel} />
          )}
        </div>
      </form>
    </div>
  );
}
