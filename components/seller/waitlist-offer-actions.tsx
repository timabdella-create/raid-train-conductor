"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function WaitlistOfferActions({
  onAccept,
  onDecline,
}: {
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        isLoading={isPending}
        onClick={() => startTransition(() => onAccept())}
      >
        Accept slot
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive"
        isLoading={isPending}
        onClick={() => {
          if (confirm("Decline this offer? It'll go to the next person on the waitlist.")) {
            startTransition(() => onDecline());
          }
        }}
      >
        Decline
      </Button>
    </div>
  );
}
