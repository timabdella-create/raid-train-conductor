"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CancelParticipationButton({
  trainName,
  action,
}: {
  trainName: string;
  action: () => Promise<{ error?: string } | void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Cancel your slot on "${trainName}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        alert(`Couldn't cancel your slot: ${result.error}`);
      }
    });
  }

  return (
    <Button type="button" variant="destructive" isLoading={isPending} onClick={handleClick}>
      Cancel my slot
    </Button>
  );
}
