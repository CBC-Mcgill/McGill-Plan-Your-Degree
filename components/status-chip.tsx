import { cn } from "cn";
import {
  ArrowRightLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  CircleSlash,
  Clock,
  Hourglass,
  Info,
  Lock,
  LockOpen,
  type LucideIcon,
  X,
} from "lucide-react";
import type { CourseState } from "@/lib/engine/status";
import type { CourseStatus as RecordStatus } from "@/lib/profile/types";

export type CourseStatus =
  | "completed"
  | "in-progress"
  | "available"
  | "locked"
  | "planned";

/** A locked course whose requirement text has conditions we cannot check shows "Check requirements" instead of "Locked". */
export type ChipStatus = CourseStatus | "check-requirements" | RecordStatus;

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
  failed: {
    label: "Failed",
    icon: X,
    tone: "border-failed/30 bg-failed-surface text-failed",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: CircleSlash,
    tone: "border-locked/30 bg-locked-surface text-locked",
  },
  deferred: {
    label: "Deferred",
    icon: Hourglass,
    tone: "border-available/30 bg-available-surface text-available",
  },
  transfer: {
    label: "Transfer credit",
    icon: ArrowRightLeft,
    tone: "border-completed/30 bg-completed-surface text-completed",
  },
  exemption: {
    label: "Exemption",
    icon: BadgeCheck,
    tone: "border-completed/30 bg-completed-surface text-completed",
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
