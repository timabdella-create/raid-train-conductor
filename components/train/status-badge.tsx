import { Badge } from "@/components/ui/badge";
import type { SlotStatus, TrainStatus } from "@/types/database.types";

const SLOT_STATUS_CONFIG: Record<SlotStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  open: { label: "Open", tone: "neutral" },
  held: { label: "Held", tone: "warning" },
  pending_approval: { label: "Pending approval", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  waitlisted: { label: "Waitlisted", tone: "info" },
  checked_in: { label: "Checked in", tone: "success" },
  live: { label: "Live now", tone: "danger" },
  completed: { label: "Completed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "danger" },
  replaced: { label: "Replaced", tone: "warning" },
  late: { label: "Late", tone: "warning" },
  no_show: { label: "No-show", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
};

const TRAIN_STATUS_CONFIG: Record<TrainStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  live: { label: "Live now", tone: "danger" },
  completed: { label: "Completed", tone: "info" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function SlotStatusBadge({ status }: { status: SlotStatus }) {
  const config = SLOT_STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function TrainStatusBadge({ status }: { status: TrainStatus }) {
  const config = TRAIN_STATUS_CONFIG[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
