import { cn } from "cn";
import {
  CalendarDays,
  Check,
  Clock,
  Info,
  Lock,
  LockOpen,
  type LucideIcon,
} from "lucide-react";
import type { CourseState } from "@/lib/engine/status";

export type CourseStatus =
  | "completed"
  | "in-progress"
  | "available"
  | "locked"
  | "planned";

/** A locked course whose requirement text has conditions we cannot check shows this instead of "Locked". */
export type ChipStatus = CourseStatus | "check-requirements";

const statuses: Record<
  ChipStatus,
  { label: string; icon: LucideIcon; tone: string }
> = {
  completed: {
    label: "Completed",
    icon: Check,
    tone: "border-completed/30 bg-completed-surface text-completed",
  },
  "in-progress": {
    label: "In progress",
    icon: Clock,
    tone: "border-in-progress/30 bg-in-progress-surface text-in-progress",
  },
  available: {
    label: "Available",
    icon: LockOpen,
    tone: "border-available/30 bg-available-surface text-available",
  },
  locked: {
    label: "Locked",
    icon: Lock,
    tone: "border-locked/30 bg-locked-surface text-locked",
  },
  planned: {
    label: "Planned",
    icon: CalendarDays,
    tone: "border-planned/30 bg-planned-surface text-planned",
  },
  "check-requirements": {
    label: "Check requirements",
    icon: Info,
    tone: "border-locked/50 border-dashed bg-locked-surface text-locked",
  },
};

/** The chip for a course state: "Check requirements" when it is locked but the requirement text is not fully checkable. */
export function chipStatus({ status, uncertain }: CourseState): ChipStatus {
  return status === "locked" && uncertain ? "check-requirements" : status;
}

export function StatusChip({
  status,
  className,
}: {
  status: ChipStatus;
  className?: string;
}) {
  const { label, icon: Icon, tone } = statuses[status];

  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 font-semibold text-xs",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" strokeWidth={2.75} />
      {label}
    </span>
  );
}
