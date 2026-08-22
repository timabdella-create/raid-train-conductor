"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlotStatusBadge } from "@/components/train/status-badge";
import { formatSlotTime } from "@/lib/trains/generate-slots";
import type { SlotStatus } from "@/types/database.types";

export interface ScheduleSlot {
  id: string;
  startDatetime: string;
  endDatetime: string;
  status: SlotStatus;
  seller: {
    displayName: string;
    whatnotUsername: string;
    group: { id: string; name: string; iconUrl: string } | null;
  } | null;
  checkedIn: boolean;
  checkInOpen: boolean;
}

interface Props {
  timezone: string;
  slots: ScheduleSlot[];
  onSwap: (slotAId: string, slotBId: string) => Promise<void>;
  onRemoveSeller: (slotId: string) => Promise<void>;
  onToggleAvailability: (slotId: string, makeUnavailable: boolean) => Promise<void>;
  onCheckIn: (slotId: string) => Promise<void>;
  onUndoCheckIn: (slotId: string) => Promise<void>;
}

function DraggableSellerCard({
  slotId,
  seller,
}: {
  slotId: string;
  seller: { displayName: string; whatnotUsername: string; group: { id: string; name: string; iconUrl: string } | null };
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: slotId });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        touchAction: "none",
      }}
      className={`cursor-grab rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm active:cursor-grabbing ${
        isDragging ? "z-10 opacity-70 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {seller.group && (
          // Stops the pointerdown/click from reaching the drag handlers spread
          // on the parent div above, so this opens the group roster instead of
          // starting a drag gesture.
          <a
            href={`/groups/${seller.group.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`${seller.group.name} \u2014 see everyone in this group`}
            className="shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seller.group.iconUrl}
              alt={seller.group.name}
              className="h-14 w-14 rounded-full border border-border object-cover"
            />
          </a>
        )}
        <p className="font-medium">{seller.displayName}</p>
      </div>
      <p className="text-xs text-muted-foreground">@{seller.whatnotUsername}</p>
    </div>
  );
}

function DroppableSlotRow({ slotId, children }: { slotId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  return (
    <div ref={setNodeRef} className={`rounded-md transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary" : ""}`}>
      {children}
    </div>
  );
}

export function ScheduleManager({
  timezone,
  slots,
  onSwap,
  onRemoveSeller,
  onToggleAvailability,
  onCheckIn,
  onUndoCheckIn,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [localSlots, setLocalSlots] = useState(slots);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const slotAId = String(active.id);
    const slotBId = String(over.id);

    // Optimistic swap so the UI feels instant; the server call reconciles it.
    setLocalSlots((prev) => {
      const next = [...prev];
      const aIndex = next.findIndex((s) => s.id === slotAId);
      const bIndex = next.findIndex((s) => s.id === slotBId);
      if (aIndex === -1 || bIndex === -1) return prev;
      const slotA = next[aIndex];
      const slotB = next[bIndex];
      if (!slotA || !slotB) return prev;
      next[aIndex] = { ...slotA, seller: slotB.seller };
      next[bIndex] = { ...slotB, seller: slotA.seller };
      return next;
    });

    startTransition(() => {
      onSwap(slotAId, slotBId);
    });
  }

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Drag a seller card onto another slot to swap who's assigned to which time.
      </p>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <ul className="space-y-2">
          {localSlots.map((slot) => (
            <li key={slot.id}>
              <DroppableSlotRow slotId={slot.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium">
                      {formatSlotTime(slot.startDatetime, timezone)} – {formatSlotTime(slot.endDatetime, timezone)}
                    </p>
                    <SlotStatusBadge status={slot.status} />
                  </div>

                  <div className="min-w-[10rem] flex-1">
                    {slot.seller ? (
                      <div className="space-y-1">
                        <DraggableSellerCard slotId={slot.id} seller={slot.seller} />
                        {slot.checkedIn ? (
                          <Badge tone="success">Checked in ✓</Badge>
                        ) : slot.checkInOpen ? (
                          <Badge tone="warning">Not checked in</Badge>
                        ) : (
                          <Badge tone="neutral">Check-in not open yet</Badge>
                        )}
                      </div>
                    ) : slot.status === "cancelled" ? (
                      <Badge tone="danger">Unavailable</Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground">Open — drop a seller here</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {slot.seller && !slot.checkedIn && (
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={isPending}
                        onClick={() => startTransition(() => onCheckIn(slot.id))}
                      >
                        Check in
                      </Button>
                    )}
                    {slot.seller && slot.checkedIn && (
                      <Button
                        type="button"
                        variant="ghost"
                        isLoading={isPending}
                        onClick={() => startTransition(() => onUndoCheckIn(slot.id))}
                      >
                        Undo check-in
                      </Button>
                    )}
                    {slot.seller && (
                      <Button
                        type="button"
                        variant="destructive"
                        isLoading={isPending}
                        onClick={() => {
                          if (confirm(`Remove ${slot.seller?.displayName} from this slot?`)) {
                            startTransition(() => onRemoveSeller(slot.id));
                          }
                        }}
                      >
                        Remove
                      </Button>
                    )}
                    {!slot.seller && slot.status !== "cancelled" && (
                      <Button
                        type="button"
                        variant="ghost"
                        isLoading={isPending}
                        onClick={() => startTransition(() => onToggleAvailability(slot.id, true))}
                      >
                        Mark unavailable
                      </Button>
                    )}
                    {!slot.seller && slot.status === "cancelled" && (
                      <Button
                        type="button"
                        variant="secondary"
                        isLoading={isPending}
                        onClick={() => startTransition(() => onToggleAvailability(slot.id, false))}
                      >
                        Reopen slot
                      </Button>
                    )}
                  </div>
                </div>
              </DroppableSlotRow>
            </li>
          ))}
        </ul>
      </DndContext>
    </div>
  );
}
