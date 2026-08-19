"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  helpText?: string;
  id?: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function ImageUploadField({
  value,
  onChange,
  label = "Train image or thumbnail (optional)",
  helpText,
  id = "trainImage",
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Use a PNG, JPEG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image must be under 5MB.");
      return;
    }

    setIsUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to upload an image.");
      setIsUploading(false);
      return;
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("train-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setIsUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("train-images").getPublicUrl(path);
    onChange(publicUrl.publicUrl);
    setIsUploading(false);
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {helpText && <p className="mb-2 text-xs text-muted-foreground">{helpText}</p>}
      {value && (
        <div className="relative mb-3 h-40 w-full overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Thumbnail preview" className="h-full w-full object-cover" />
        </div>
      )}
      <input
        id={id}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleFileChange}
        disabled={isUploading}
        className="block w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-md file:border-0 file:bg-muted file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-muted/70"
      />
      {isUploading && <p className="mt-1 text-sm text-muted-foreground">Uploading…</p>}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      {value && !isUploading && (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 min-h-0 px-2 py-1 text-xs text-destructive"
          onClick={() => onChange("")}
        >
          Remove image
        </Button>
      )}
    </div>
  );
}
