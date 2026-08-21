import { z } from "zod";

export const TRAIN_CATEGORIES = [
  "Plush",
  "Clothing",
  "Vintage",
  "Toys",
  "Storage Units",
  "Trading Cards",
  "Jewelry",
  "Collectibles",
  "Books",
  "Home Decor",
  "Pen Battle",
  "General Merchandise",
] as const;

export const CHECK_IN_PRESETS = [
  { label: "24 hours before the train", minutes: 1440 },
  { label: "2 hours before my slot", minutes: 120 },
  { label: "30 minutes before my slot", minutes: 30 },
] as const;

// The banner renders as a short, very wide strip (see app/train/[slug]/page.tsx),
// so it crops most images horizontally. This controls the vertical anchor —
// lets an organizer whose subject sits near the top or bottom of their image
// keep it visible instead of getting trimmed by the crop.
export const IMAGE_POSITIONS = ["top", "center", "bottom"] as const;

// The banner's shape changes a lot by screen size (close to square on
// mobile, panoramic on desktop), so a single crop can lose content on one
// screen size or the other for images with detail running edge-to-edge.
// "contain" opts out of cropping entirely — the whole image always shows.
export const IMAGE_FITS = ["cover", "contain"] as const;

// ---------------------------------------------------------------------------
// Step 1 — Basic details
// ---------------------------------------------------------------------------
export const basicDetailsSchema = z.object({
  name: z.string().trim().min(3, "Give your train a name (at least 3 characters).").max(100),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  theme: z.string().trim().max(100).optional().or(z.literal("")),
  category: z.enum(TRAIN_CATEGORIES, { required_error: "Choose a category." }),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  imagePosition: z.enum(IMAGE_POSITIONS).default("center"),
  imageFit: z.enum(IMAGE_FITS).default("cover"),
  sellerThumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
});
export type BasicDetailsInput = z.infer<typeof basicDetailsSchema>;

// ---------------------------------------------------------------------------
// Step 2 — Date & schedule
// ---------------------------------------------------------------------------
export const scheduleSchema = z
  .object({
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose an end time."),
    timezone: z.string().min(1, "Choose a time zone."),
    slotDurationMinutes: z.coerce
      .number()
      .int()
      .min(5, "Slots must be at least 5 minutes.")
      .max(240, "Slots must be 4 hours or less."),
    breakMinutes: z.coerce.number().int().min(0).max(120).default(0),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });
export type ScheduleInput = z.infer<typeof scheduleSchema>;

// ---------------------------------------------------------------------------
// Step 3 — Signup settings
// ---------------------------------------------------------------------------
export const signupSettingsSchema = z.object({
  signupMode: z.enum(["open", "approval_required", "invite_only", "waitlist_only"], {
    required_error: "Choose a signup mode.",
  }),
  visibility: z.enum(["public", "unlisted", "private"], {
    required_error: "Choose who can view this train.",
  }),
});
export type SignupSettingsInput = z.infer<typeof signupSettingsSchema>;

// ---------------------------------------------------------------------------
// Step 4 — Seller requirements
// ---------------------------------------------------------------------------
export const requirementsSchema = z.object({
  requiresWhatnotProfile: z.boolean().default(true),
  requiresShowLink: z.boolean().default(true),
  salesLevelRequirement: z.string().trim().max(100).optional().or(z.literal("")),
  additionalQuestions: z
    .array(z.string().trim().min(1).max(200))
    .max(5, "Up to 5 additional questions.")
    .default([]),
});
export type RequirementsInput = z.infer<typeof requirementsSchema>;

// ---------------------------------------------------------------------------
// Step 5 — Rules
// ---------------------------------------------------------------------------
export const DISCORD_WEBHOOK_URL_PATTERN = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;

export const rulesSchema = z.object({
  rules: z.string().trim().max(5000).optional().or(z.literal("")),
  cancellationPolicy: z.string().trim().max(5000).optional().or(z.literal("")),
  checkInMinutesBefore: z.coerce.number().int().min(0).max(10080).default(120),
  discordWebhookUrl: z
    .string()
    .trim()
    .regex(DISCORD_WEBHOOK_URL_PATTERN, "Enter a Discord webhook URL, e.g. https://discord.com/api/webhooks/123/abc")
    .optional()
    .or(z.literal("")),
});
export type RulesInput = z.infer<typeof rulesSchema>;

// ---------------------------------------------------------------------------
// Combined — what the server action ultimately receives
// ---------------------------------------------------------------------------
export const createTrainSchema = basicDetailsSchema
  .and(scheduleSchema.innerType().partial({ breakMinutes: true }))
  .and(signupSettingsSchema)
  .and(requirementsSchema)
  .and(rulesSchema)
  .and(z.object({ action: z.enum(["draft", "publish"]) }));

export type CreateTrainInput = BasicDetailsInput &
  ScheduleInput &
  SignupSettingsInput &
  RequirementsInput &
  RulesInput & { action: "draft" | "publish" };

export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "UTC",
] as const;
