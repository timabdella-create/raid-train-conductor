// Shared FormData -> raw-object parsing for the train wizard, used by both
// the create and update Server Actions so their validation stays identical.

export function parseTrainFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    theme: formData.get("theme"),
    category: formData.get("category"),
    imageUrl: formData.get("imageUrl"),
    imagePosition: formData.get("imagePosition") || "center",
    imageFit: formData.get("imageFit") || "cover",
    sellerThumbnailUrl: formData.get("sellerThumbnailUrl"),
    eventDate: formData.get("eventDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    timezone: formData.get("timezone"),
    slotDurationMinutes: formData.get("slotDurationMinutes"),
    breakMinutes: formData.get("breakMinutes") || "0",
    signupMode: formData.get("signupMode"),
    visibility: formData.get("visibility"),
    requiresWhatnotProfile: formData.get("requiresWhatnotProfile") === "true",
    requiresShowLink: formData.get("requiresShowLink") === "true",
    salesLevelRequirement: formData.get("salesLevelRequirement"),
    additionalQuestions: safeParseJsonArray(formData.get("additionalQuestions")),
    rules: formData.get("rules"),
    cancellationPolicy: formData.get("cancellationPolicy"),
    checkInMinutesBefore: formData.get("checkInMinutesBefore"),
    discordWebhookUrl: formData.get("discordWebhookUrl"),
    // The group picker in the Rules step only renders when the organizer
    // actually administers a group, so for everyone else this field is
    // entirely absent from the form -- formData.get() then returns null,
    // which zod's .optional() doesn't accept (only undefined). Without
    // this fallback, every organizer with zero admin-able groups got a
    // silent-ish "fix the highlighted fields" error with no field to fix,
    // because the field causing it was the one that wasn't rendered.
    groupId: formData.get("groupId") || undefined,
    action: formData.get("action"),
  };
}

function safeParseJsonArray(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
