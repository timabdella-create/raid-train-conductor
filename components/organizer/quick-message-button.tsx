"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function QuickMessageButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      isLoading={isPending}
      className="text-xs"
      onClick={() =>
        startTransition(async () => {
          await action();
          setSent(true);
          setTimeout(() => setSent(false), 2500);
        })
      }
    >
      {sent ? "Sent ✓" : label}
    </Button>
  );
}
