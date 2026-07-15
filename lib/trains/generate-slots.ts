import { fromZonedTime } from "date-fns-tz";

export interface GenerateSlotsInput {
  /** ISO date, e.g. "2026-08-16" */
  eventDate: string;
  /** "HH:mm" or "HH:mm:ss" in the train's local timezone */
  startTime: string;
  /** "HH:mm" or "HH:mm:ss" in the train's local timezone */
  endTime: string;
  /** IANA timezone, e.g. "America/New_York" */
  timezone: string;
  slotDurationMinutes: number;
  /** Minutes of break inserted after every slot. 0 = back-to-back. */
  breakMinutes?: number;
}

export interface GeneratedSlot {
  position: number;
  /** UTC ISO string, safe to store directly in a `timestamptz` column. */
  startDatetime: string;
  /** UTC ISO string, safe to store directly in a `timestamptz` column. */
  endDatetime: string;
}

/**
 * Turns "10:00 AM to 12:00 PM, 30-minute slots, 5-minute breaks" into a
 * concrete list of UTC-anchored slot start/end times. Pure function — no
 * database access — so it's easy to unit test and to preview client-side
 * before the organizer commits to a train.
 */
export function generateSlots(input: GenerateSlotsInput): GeneratedSlot[] {
  const { eventDate, startTime, timezone, slotDurationMinutes } = input;
  const breakMinutes = input.breakMinutes ?? 0;

  if (slotDurationMinutes <= 0) {
    throw new Error("Slot duration must be greater than zero.");
  }

  const normalizedStart = startTime.length === 5 ? `${startTime}:00` : startTime;
  const normalizedEnd = input.endTime.length === 5 ? `${input.endTime}:00` : input.endTime;

  const trainStart = fromZonedTime(`${eventDate}T${normalizedStart}`, timezone);
  const trainEnd = fromZonedTime(`${eventDate}T${normalizedEnd}`, timezone);

  if (trainEnd.getTime() <= trainStart.getTime()) {
    throw new Error("End time must be after start time.");
  }

  const slots: GeneratedSlot[] = [];
  const stepMs = (slotDurationMinutes + breakMinutes) * 60_000;
  const slotMs = slotDurationMinutes * 60_000;

  let cursor = trainStart.getTime();
  let position = 0;

  while (cursor + slotMs <= trainEnd.getTime()) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + slotMs);
    slots.push({
      position,
      startDatetime: slotStart.toISOString(),
      endDatetime: slotEnd.toISOString(),
    });
    position += 1;
    cursor += stepMs;
  }

  return slots;
}

/** Formats a UTC ISO datetime back into a local "10:00 AM" style label for the given timezone. */
export function formatSlotTime(isoDatetime: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(isoDatetime));
}
