"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { isBookmarked, toggleBookmark, onBookmarksChanged } from "@/lib/bookmarks/local-bookmarks";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  sellerId,
  whatnotUsername,
  whatnotProfileUrl,
  trainSlug,
  trainName,
}: {
  sellerId: string;
  whatnotUsername: string;
  whatnotProfileUrl: string;
  trainSlug: string;
  trainName: string;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(sellerId));
    setMounted(true);
    // Stay in sync if bookmarks change elsewhere on the page — e.g. the
    // "Bookmark all" button, or another BookmarkButton for the same seller.
    return onBookmarksChanged(() => setBookmarked(isBookmarked(sellerId)));
  }, [sellerId]);

  function handleClick() {
    const nowBookmarked = toggleBookmark({
      sellerId,
      whatnotUsername,
      whatnotProfileUrl,
      trainSlug,
      trainName,
    });
    setBookmarked(nowBookmarked);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        bookmarked ? `Remove @${whatnotUsername} from saved shows` : `Save @${whatnotUsername}'s show`
      }
      aria-pressed={bookmarked}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
        mounted && bookmarked ? "text-accent" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Bookmark className="h-4 w-4" fill={mounted && bookmarked ? "currentColor" : "none"} />
    </button>
  );
}
