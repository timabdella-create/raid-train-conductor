"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { addBookmarks } from "@/lib/bookmarks/local-bookmarks";
import { cn } from "@/lib/utils";

type SellerEntry = {
  sellerId: string;
  whatnotUsername: string;
  whatnotProfileUrl: string;
};

export function BookmarkAllButton({
  sellers,
  trainSlug,
  trainName,
}: {
  sellers: SellerEntry[];
  trainSlug: string;
  trainName: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  if (sellers.length === 0) return null;

  function handleClick() {
    const added = addBookmarks(
      sellers.map((s) => ({ ...s, trainSlug, trainName }))
    );
    setMessage(
      added === 0
        ? "Already saved"
        : `Saved ${added} show${added === 1 ? "" : "s"}`
    );
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium",
          "text-foreground transition-colors hover:bg-muted"
        )}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        Bookmark all
      </button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
