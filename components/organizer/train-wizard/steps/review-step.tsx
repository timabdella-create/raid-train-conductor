"use client";

import { formatSlotTime, generateSlots } from "@/lib/trains/generate-slots";
import { Badge } from "@/components/ui/badge";
import type { WizardData } from "../train-wizard";

interface Props {
  data: WizardData;
  visible: boolean;
}

export function ReviewStep({ data, visible }: Props) {
  let slotCount = 0;
  let firstSlotLabel: string | null = null;
  try {
    if (data.eventDate && data.startTime && data.endTime && data.slotDurationMinutes) {
      const slots = generateSlots({
        eventDate: data.eventDate,
        startTime: data.startTime,
        endTime: data.endTime,
        timezone: data.timezone,
        slotDurationMinutes: Number(data.slotDurationMinutes),
        breakMinutes: Number(data.breakMinutes || 0),
      });
      slotCount = slots.length;
      firstSlotLabel = slots[0] ? formatSlotTime(slots[0].startDatetime, data.timezone) : null;
    }
  } catch {
    // Validation errors surface on the schedule step; nothing to show here.
  }

  return (
    <div className={visible ? "space-y-4" : "hidden"}>
      <div className="rounded-md border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{data.name || "Untitled train"}</h3>
            <p className="text-sm text-muted-foreground">
              {data.category || "No category"} {data.theme && `• ${data.theme}`}
            </p>
          </div>
          <Badge tone="info">{data.visibility}</Badge>
        </div>

        {data.description && <p className="mt-3 text-sm">{data.description}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Date</dt>
            <dd>{data.eventDate || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Time</dt>
            <dd>
              {data.startTime || "—"}–{data.endTime || "—"} ({data.timezone})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slot length</dt>
            <dd>{data.slotDurationMinutes} min</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Slots generated</dt>
            <dd>
              {slotCount} {firstSlotLabel && `(starting ${firstSlotLabel})`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Signup mode</dt>
            <dd className="capitalize">{data.signupMode.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Check-in opens</dt>
            <dd>{data.checkInMinutesBefore} minutes before</dd>
          </div>
        </dl>

        {data.additionalQuestions.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Additional questions for sellers</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {data.additionalQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Save as a draft to keep working on it privately, or publish to make it
        live at its public URL right away.
      </p>
    </div>
  );
}
