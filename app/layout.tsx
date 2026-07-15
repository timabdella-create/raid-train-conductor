import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raid Train Conductor",
  description:
    "Build the schedule, fill open slots, and run your Whatnot raid train from one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
