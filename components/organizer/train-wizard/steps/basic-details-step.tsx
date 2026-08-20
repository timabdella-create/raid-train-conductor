"use client";

import { TRAIN_CATEGORIES, IMAGE_POSITIONS } from "@/lib/validations/train";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/organizer/image-upload-field";
import type { WizardData } from "../train-wizard";

const IMAGE_FIT_OPTIONS = [
  {
    value: "cover",
    label: "Fill the banner",
    description: "Crops the image to fill the strip edge-to-edge. Best for photos with breathing room around the edges.",
  },
  {
    value: "contain",
    label: "Show the whole image",
    description: "Never crops — fits the full image in the banner, with a soft blurred fill behind it. Best for graphics or posters with text near the edges.",
  },
] as const;

interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
  visible: boolean;
}

export function BasicDetailsStep({ data, update, errors, visible }: Props) {
  return (
    <div className={visible ? "space-y-4" : "hidden"}>
      <div>
        <Label htmlFor="name">Train name</Label>
        <Input
          id="name"
          name="name"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Sunday Plush Express"
          required
        />
        {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
      </div>

      <div>
        <Label htmlFor="description">Description and rules</Label>
        <Textarea
          id="description"
          name="description"
          value={data.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="What's this raid train about?"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="theme">Theme (optional)</Label>
          <Input
            id="theme"
            name="theme"
            value={data.theme}
            onChange={(e) => update({ theme: e.target.value })}
            placeholder="Christmas in July"
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            id="category"
            name="category"
            value={data.category}
            onChange={(e) => update({ category: e.target.value })}
            required
          >
            <option value="">Choose a category…</option>
            {TRAIN_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          {errors.category && <p className="mt-1 text-sm text-destructive">{errors.category}</p>}
        </div>
      </div>

      <ImageUploadField
        label="Train banner (optional)"
        helpText="Sits behind the train name at the top of the page. Use a landscape image, ideally around 1600×700px (at least 1200px wide) — taller square-ish images still get cropped some, so keep the important part roughly centered, and use the focal point option below if it's getting trimmed off the top or bottom."
        value={data.imageUrl}
        onChange={(url) => update({ imageUrl: url })}
      />
      <input type="hidden" name="imageUrl" value={data.imageUrl} />

      {data.imageUrl && (
        <div className="space-y-4 rounded-md border border-border p-3">
          <div>
            <Label htmlFor="imageFit">How should the banner be shown?</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              The banner's shape changes a lot by screen size — close to square on mobile, wide on
              desktop — so a graphic with text or detail running edge-to-edge (like a poster) can lose
              content on one or the other no matter how it's cropped. "Show the whole image" fixes that
              by never cropping.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {IMAGE_FIT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex flex-1 cursor-pointer items-start gap-2 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="imageFit"
                    value={opt.value}
                    checked={data.imageFit === opt.value}
                    onChange={() => update({ imageFit: opt.value })}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="imagePosition">
              {data.imageFit === "contain" ? "Image alignment" : "Banner focal point"}
            </Label>
            <p className="mb-2 text-xs text-muted-foreground">
              {data.imageFit === "contain"
                ? "Where to anchor the image within the banner if there's extra space."
                : "If the top or bottom of your image is getting cropped off, nudge this to match where the important part is."}
            </p>
            <div className="flex gap-2">
              {IMAGE_POSITIONS.map((pos) => (
                <label
                  key={pos}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm capitalize has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="imagePosition"
                    value={pos}
                    checked={data.imagePosition === pos}
                    onChange={() => update({ imagePosition: pos })}
                    className="accent-primary"
                  />
                  {pos}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <ImageUploadField
          id="sellerThumbnail"
          label="Seller show thumbnail (optional)"
          helpText="A separate image sellers can download from the train page and use as their own Whatnot show thumbnail — different from the banner image above."
          value={data.sellerThumbnailUrl}
          onChange={(url) => update({ sellerThumbnailUrl: url })}
        />
        <input type="hidden" name="sellerThumbnailUrl" value={data.sellerThumbnailUrl} />
      </div>
    </div>
  );
}
