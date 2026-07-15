// Slug helpers for public train URLs, e.g. /train/sunday-plush-express.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "raid-train";
}

/** Appends a short random suffix, used when the base slug is already taken. */
export function withUniqueSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/** Short, URL-safe code used to gate access to a private train. */
export function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
