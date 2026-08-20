"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AnnouncementPopup() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md rounded-lg border border-white/15 bg-card p-6 text-foreground shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <h2 id="announcement-title" className="pr-6 font-display text-xl font-bold">
          🎉 Ride. Organize. Win!
        </h2>

        <p className="mt-3 text-sm text-muted-foreground">
          Every week, we&apos;ll select two winners from our raid train community:
        </p>

        <ul className="mt-3 space-y-1 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            1 Rider Winner
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            1 Organizer Winner
          </li>
        </ul>

        <p className="mt-3 text-sm text-muted-foreground">
          Each winner will receive a $5 gift card just for participating in raid trains on our site! The more you
          participate, the more chances you have to be part of the fun. Join trains, support other sellers, and help
          keep the community moving! 🚂✨
        </p>

        <Button className="mt-6 w-full" onClick={() => setOpen(false)}>
          Let&apos;s go
        </Button>
      </div>
    </div>
  );
}
