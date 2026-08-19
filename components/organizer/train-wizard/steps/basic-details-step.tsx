"use client";

import { TRAIN_CATEGORIES, IMAGE_POSITIONS } from "@/lib/validations/train";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/organizer/image-upload-field";
import type { WizardData } from "../train-wizard";

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
        <Label htmlFor="description">Description</Label>
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
        helpText="Sits behind the train name at the top of the page. Use a landscape image, ideally around 1600×500px (at least 1200px wide) — it's cropped to fill a wide strip, so keep the important part roughly centered since the edges can get trimmed on very wide or narrow screens."
        value={data.imageUrl}
        onChange={(url) => update({ imageUrl: url })}
      />
      <input type="hidden" name="imageUrl" value={data.imageUrl} />

      {data.imageUrl && (
        <div>
          <Label htmlFor="imagePosition">Banner focal point</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            If the top or bottom of your image is getting cropped off, nudge this to match where the
            important part is.
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
