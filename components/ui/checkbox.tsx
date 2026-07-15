import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ className, label, description, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-[44px] cursor-pointer items-start gap-3 rounded-md border border-border p-3",
          "has-[:checked]:border-primary has-[:checked]:bg-primary/5",
          className
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          {...props}
        />
        <span>
          <span className="block text-sm font-medium">{label}</span>
          {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        </span>
      </label>
    );
  }
);
CheckboxField.displayName = "CheckboxField";
