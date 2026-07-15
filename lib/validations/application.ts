import { z } from "zod";

/**
 * Builds the seller application schema for a specific train, since which
 * fields are required (show URL, custom questions) depends on that train's
 * settings. Rules agreement is always required — sellers can't submit
 * without acknowledging them.
 */
export function buildApplicationSchema(options: { requiresShowLink: boolean; questionCount: number }) {
  return z.object({
    showUrl: options.requiresShowLink
      ? z
          .string()
          .trim()
          .url("Enter your scheduled show link, e.g. https://www.whatnot.com/live/…")
          .refine((url) => url.startsWith("https://"), "Show link must use https://")
      : z.string().trim().url().optional().or(z.literal("")),
    sellerNotes: z.string().trim().max(1000).optional().or(z.literal("")),
    customAnswers: z
      .array(z.string().trim().max(500))
      .length(options.questionCount)
      .default([]),
    agreedToRules: z.literal("true", {
      errorMap: () => ({ message: "You must agree to the train rules to apply." }),
    }),
  });
}

export const waitlistJoinSchema = z.object({
  preferredTimes: z.string().trim().max(300).optional().or(z.literal("")),
});
