import { cn } from "cn";
import { X } from "lucide-react";
import type * as React from "react";

/** Interactive filter. Rounded, 28px, and it shows a remove button once it has a value. */
function Chip({
  active = false,
  onRemove,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full text-[13px] transition-colors",
        active
          ? "bg-in-progress-surface text-[color-mix(in_oklab,var(--in-progress)_80%,black)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--in-progress)_30%,white)]"
          : "bg-card text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-subtle",
        className,
      )}
    >
      <button
        type="button"
        aria-pressed={onRemove ? undefined : active}
        className={cn(
          "inline-flex h-full items-center gap-1.5 rounded-full pl-3 font-medium [&_svg]:size-3.5",
          onRemove ? "pr-1" : "pr-3",
        )}
        {...props}
      >
        {children}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="mr-1 inline-flex size-5 items-center justify-center rounded-full hover:bg-black/5"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  );
}

export { Chip };
