import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

const ICONS = {
  info: { Icon: Info, color: "text-fg-muted" },
  warn: { Icon: TriangleAlert, color: "text-warn" },
  danger: { Icon: CircleAlert, color: "text-danger" },
};

/** An icon in the meaning color and a sentence, never a box. `action` is a text button after the sentence. */
export function Notice({
  tone,
  children,
  action,
  role,
}: {
  tone: "info" | "warn" | "danger";
  children: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status";
}) {
  const { Icon, color } = ICONS[tone];
  return (
    <div role={role} className="flex items-start gap-2 text-fg">
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${color}`} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-4">
        <div>{children}</div>
        {action && <div className="-my-2">{action}</div>}
      </div>
    </div>
  );
}
