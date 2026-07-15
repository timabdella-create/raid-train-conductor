"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CheckInButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button type="button" isLoading={isPending} onClick={() => startTransition(() => action())}>
      Check in
    </Button>
  );
}
