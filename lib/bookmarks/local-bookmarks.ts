// Client-side "saved shows" — no account needed. Anyone browsing a public
// train page can bookmark a seller with one click; the list lives in
// localStorage on their own device (no server round-trip, no login wall).

export type BookmarkedSeller = {
  sellerId: string;
  whatnotUsername: string;
  whatnotProfileUrl: string;
  trainSlug: string;
  trainName: string;
  savedAt: string;
};

const STORAGE_KEY = "rtc_bookmarked_sellers";

export function getBookmarks(): BookmarkedSeller[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BookmarkedSeller[]) : [];
  } catch {
    return [];
  }
}

export function isBookmarked(sellerId: string): boolean {
  return getBookmarks().some((b) => b.sellerId === sellerId);
}

/** Adds or removes the bookmark and returns the new bookmarked state. */
export function toggleBookmark(entry: Omit<BookmarkedSeller, "savedAt">): boolean {
  if (typeof window === "undefined") return false;
  const current = getBookmarks();
  const exists = current.some((b) => b.sellerId === entry.sellerId);
  const next = exists
    ? current.filter((b) => b.sellerId !== entry.sellerId)
    : [...current, { ...entry, savedAt: new Date().toISOString() }];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return !exists;
}

export function removeBookmark(sellerId: string): void {
  if (typeof window === "undefined") return;
  const next = getBookmarks().filter((b) => b.sellerId !== sellerId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
