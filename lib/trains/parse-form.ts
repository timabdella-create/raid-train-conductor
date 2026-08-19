// Shared FormData -> raw-object parsing for the train wizard, used by both
// the create and update Server Actions so their validation stays identical.

export function parseTrainFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    theme: formData.get("theme"),
    category: formData.get("category"),
    imageUrl: formData.get("imageUrl"),
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
