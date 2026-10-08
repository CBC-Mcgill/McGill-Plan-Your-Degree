import { cn } from "cn";
import {
  CalendarDays,
  Check,
  Clock,
  Lock,
  LockOpen,
  type LucideIcon,
} from "lucide-react";

export type CourseStatus =
  | "completed"
  | "in-progress"
  | "available"
  | "locked"
  | "planned";

const statuses: Record<
  CourseStatus,
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
};

export function StatusChip({
  status,
  className,
}: {
  status: CourseStatus;
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
