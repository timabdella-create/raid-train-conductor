"use client";

import { TRAIN_CATEGORIES } from "@/lib/validations/train";
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

      <ImageUploadField value={data.imageUrl} onChange={(url) => update({ imageUrl: url })} />
      <input type="hidden" name="imageUrl" value={data.imageUrl} />

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
