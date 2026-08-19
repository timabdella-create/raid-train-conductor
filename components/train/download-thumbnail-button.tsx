"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DownloadThumbnailButtonProps {
  url: string;
  trainName: string;
}

export function DownloadThumbnailButton({ url, trainName }: DownloadThumbnailButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [fallback, setFallback] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    setFallback(false);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const ext = (url.split(".").pop() || "jpg").split(/[?#]/)[0];
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${trainName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-show-thumbnail.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Cross-origin fetch can fail in some environments — fall back to
      // opening the image directly so the seller can still save it manually.
      setFallback(true);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div>
      <Button type="button" variant="secondary" onClick={handleDownload} isLoading={isDownloading}>
        Download show thumbnail
      </Button>
      {fallback && (
        <p className="mt-1 text-xs text-muted-foreground">Opened the image in a new tab — save it from there.</p>
      )}
    </div>
  );
}
