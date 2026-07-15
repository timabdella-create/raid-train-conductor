"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CancelParticipationButton({
  trainName,
  action,
}: {
  trainName: string;
  action: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Cancel your slot on "${trainName}"? This can't be undone.`)) return;
    startTransition(() => {
      action();
    });
  }

  return (
    <Button type="button" variant="destructive" isLoading={isPending} onClick={handleClick}>
      Cancel my slot
    </Button>
  );
}
