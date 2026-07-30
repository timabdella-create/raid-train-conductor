"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { getBookmarks, removeBookmark, type BookmarkedSeller } from "@/lib/bookmarks/local-bookmarks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function BookmarksList() {
  const [bookmarks, setBookmarks] = useState<BookmarkedSeller[] | null>(null);

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  if (bookmarks === null) return null;

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <Bookmark className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">No saved shows yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Browse a train's schedule and tap the bookmark icon next to a seller's name to save their show here.
        </p>
      </div>
    );
  }

  const sorted = [...bookmarks].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  return (
    <ul className="space-y-3">
      {sorted.map((b) => (
        <Card key={b.sellerId} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <a
              href={b.whatnotProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
            >
              @{b.whatnotUsername}
            </a>
            <p className="text-sm text-muted-foreground">
              Saved from{" "}
              <Link href={`/train/${b.trainSlug}`} className="hover:underline">
                {b.trainName}
              </Link>
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              removeBookmark(b.sellerId);
              setBookmarks(getBookmarks());
            }}
          >
            Remove
          </Button>
        </Card>
      ))}
    </ul>
  );
}
