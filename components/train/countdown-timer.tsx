"use client";

import { useEffect, useState } from "react";

interface Props {
  /** UTC ISO datetime of the moment we're counting down to. */
  target: string;
  label: string;
}

function getRemaining(target: string) {
  const diffMs = new Date(target).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

export function CountdownTimer({ target, label }: Props) {
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (!remaining) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="rounded-md bg-primary/10 px-4 py-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-bold tabular-nums text-primary">
        {remaining.hours > 0 ? `${pad(remaining.hours)}:` : ""}
        {pad(remaining.minutes)}:{pad(remaining.seconds)}
      </p>
    </div>
  );
}
