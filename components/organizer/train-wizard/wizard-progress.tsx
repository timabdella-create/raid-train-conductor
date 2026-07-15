"use client";

const STEPS = [
  "Basic details",
  "Date & schedule",
  "Signup settings",
  "Seller requirements",
  "Rules",
  "Review & publish",
];

export function WizardProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-6 overflow-x-auto">
      <ol className="flex min-w-max items-center">
        {STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const isComplete = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          return (
            <li key={label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : isComplete
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isComplete ? "✓" : stepNumber}
                </div>
                <span
                  className={`w-20 text-center text-[11px] leading-tight ${
                    isActive ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
              {stepNumber < STEPS.length && (
                <div
                  className={`mx-1 h-0.5 w-8 sm:w-12 ${isComplete ? "bg-primary" : "bg-border"}`}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
