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
const CHANGE_EVENT = "rtc-bookmarks-changed";

function writeBookmarks(next: BookmarkedSeller[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Subscribe to bookmark changes made anywhere on the page (e.g. another
 * bookmark button, or "Bookmark all"). Returns an unsubscribe function. */
export function onBookmarksChanged(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

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
  writeBookmarks(next);
  return !exists;
}

export function removeBookmark(sellerId: string): void {
  if (typeof window === "undefined") return;
  writeBookmarks(getBookmarks().filter((b) => b.sellerId !== sellerId));
}

/** Adds every entry not already bookmarked. Returns how many were newly added. */
export function addBookmarks(entries: Omit<BookmarkedSeller, "savedAt">[]): number {
  if (typeof window === "undefined") return 0;
  const current = getBookmarks();
  const existingIds = new Set(current.map((b) => b.sellerId));
  const savedAt = new Date().toISOString();
  const toAdd = entries.filter((e) => !existingIds.has(e.sellerId));
  if (toAdd.length === 0) return 0;
  writeBookmarks([...current, ...toAdd.map((e) => ({ ...e, savedAt }))]);
  return toAdd.length;
}
