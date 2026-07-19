"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function RoleSwitcher({
  hasOrganizerProfile,
  hasSellerProfile,
}: {
  hasOrganizerProfile: boolean;
  hasSellerProfile: boolean;
}) {
  const pathname = usePathname();
  const isOrganizerView = pathname?.startsWith("/dashboard/organizer") ?? false;
  const isSellerView = pathname?.startsWith("/dashboard/seller") ?? false;

  if (hasOrganizerProfile && hasSellerProfile) {
    return (
      <div className="flex items-center rounded-full border border-border bg-muted p-0.5 text-sm">
        <Link
          href="/dashboard/organizer"
          className={cn(
            "rounded-full px-3 py-1 font-medium transition-colors",
            isOrganizerView
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Organizer
        </Link>
        <Link
          href="/dashboard/seller"
          className={cn(
            "rounded-full px-3 py-1 font-medium transition-colors",
            isSellerView
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Seller
        </Link>
      </div>
    );
  }

  if (hasOrganizerProfile) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/dashboard/organizer" className="font-medium hover:underline">
          Organizer dashboard
        </Link>
        <Link href="/dashboard/seller" className="text-muted-foreground hover:underline">
          + Become a seller
        </Link>
      </div>
    );
  }

  if (hasSellerProfile) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/dashboard/seller" className="font-medium hover:underline">
          Seller dashboard
        </Link>
        <Link href="/dashboard/organizer" className="text-muted-foreground hover:underline">
          + Become an organizer
        </Link>
      </div>
    );
  }

  return (
    <Link href="/dashboard" className="hover:underline">
      Dashboard
    </Link>
  );
}
