"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { COMMON_TIMEZONES } from "@/lib/validations/train";
import { generateSlots, formatSlotTime } from "@/lib/trains/generate-slots";
import type { WizardData } from "../train-wizard";

interface Props {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  errors: Record<string, string>;
  visible: boolean;
  locked?: boolean;
}

export function ScheduleStep({ data, update, errors, visible, locked }: Props) {
  const preview = useMemo(() => {
    if (!data.eventDate || !data.startTime || !data.endTime || !data.timezone || !data.slotDurationMinutes) {
      return null;
    }
    try {
      const slots = generateSlots({
        eventDate: data.eventDate,
        startTime: data.startTime,
        endTime: data.endTime,
        timezone: data.timezone,
        slotDurationMinutes: Number(data.slotDurationMinutes),
        breakMinutes: Number(data.breakMinutes || 0),
      });
      return slots;
    } catch {
      return null;
    }
  }, [data.eventDate, data.startTime, data.endTime, data.timezone, data.slotDurationMinutes, data.breakMinutes]);

  return (
    <div className={visible ? "space-y-4" : "hidden"}>
      {locked && (
        <>
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            The date and time settings are locked because a seller is already
            confirmed or has an application pending on this train — changing
            the schedule now would strand them. Resolve or remove those first
            if you need to reschedule.
          </p>
          {/* Disabled inputs are excluded from FormData entirely on submit,
              so once locked, the visible fields below stop being sent at
              all -- these hidden mirrors keep the current values flowing
              through on every save, no matter which step the organizer is
              actually trying to change. */}
          <input type="hidden" name="eventDate" value={data.eventDate} />
          <input type="hidden" name="timezone" value={data.timezone} />
          <input type="hidden" name="startTime" value={data.startTime} />
          <input type="hidden" name="endTime" value={data.endTime} />
          <input type="hidden" name="slotDurationMinutes" value={data.slotDurationMinutes} />
          <input type="hidden" name="breakMinutes" value={data.breakMinutes} />
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="eventDate">Date</Label>
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            value={data.eventDate}
            onChange={(e) => update({ eventDate: e.target.value })}
            disabled={locked}
            required
          />
          {errors.eventDate && <p className="mt-1 text-sm text-destructive">{errors.eventDate}</p>}
        </div>
        <div>
          <Label htmlFor="timezone">Time zone</Label>
          <Select
            id="timezone"
            name="timezone"
            value={data.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            disabled={locked}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startTime">Start time</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            value={data.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
            disabled={locked}
            required
          />
        </div>
        <div>
          <Label htmlFor="endTime">End time</Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            value={data.endTime}
            onChange={(e) => update({ endTime: e.target.value })}
            disabled={locked}
            required
          />
          {errors.endTime && <p className="mt-1 text-sm text-destructive">{errors.endTime}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="slotDurationMinutes">Slot length (minutes)</Label>
          <Input
            id="slotDurationMinutes"
            name="slotDurationMinutes"
            type="number"
            min={5}
            max={240}
            value={data.slotDurationMinutes}
            onChange={(e) => update({ slotDurationMinutes: e.target.value })}
            disabled={locked}
            required
          />
          {errors.slotDurationMinutes && (
            <p className="mt-1 text-sm text-destructive">{errors.slotDurationMinutes}</p>
          )}
        </div>
        <div>
          <Label htmlFor="breakMinutes">Break between slots (minutes, optional)</Label>
          <Input
            id="breakMinutes"
            name="breakMinutes"
            type="number"
            min={0}
            max={120}
            value={data.breakMinutes}
            onChange={(e) => update({ breakMinutes: e.target.value })}
            disabled={locked}
          />
        </div>
      </div>

      {preview && (
        <div className="rounded-md border border-border p-4">
          <p className="mb-2 text-sm font-medium">
            {preview.length} slot{preview.length === 1 ? "" : "s"} will be created
          </p>
          <div className="flex flex-wrap gap-2">
            {preview.slice(0, 12).map((slot) => (
              <span
                key={slot.position}
                className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
              >
                {formatSlotTime(slot.startDatetime, data.timezone)}
              </span>
            ))}
            {preview.length > 12 && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                +{preview.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
