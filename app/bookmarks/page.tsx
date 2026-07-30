import { BookmarksList } from "@/components/bookmarks/bookmarks-list";

export default function BookmarksPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Saved shows</h1>
        <p className="mt-1 text-muted-foreground">
          Sellers you've bookmarked from train pages, saved on this device.
        </p>
        <div className="mt-6">
          <BookmarksList />
        </div>
      </div>
    </main>
  );
}
