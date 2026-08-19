import { SiteHeader } from "@/components/nav/site-header";

// Train pages (the public schedule page and the apply flow) previously had
// no way back to the homepage or the viewer's own dashboard short of the
// browser's back button. This layout adds the same header used across the
// dashboard — logo links home, "Edit profile" links to the signed-in user's
// profile — to every route nested under /train/[slug].
export default function TrainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      {children}
    </div>
  );
}
