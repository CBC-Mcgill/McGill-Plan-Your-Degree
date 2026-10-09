import { cn } from "cn";
import { X } from "lucide-react";
import type * as React from "react";

/** Interactive filter. 28px with button corners, and it shows a remove button once it has a value. The focus ring wraps the whole chip. */
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
        "inline-flex h-7 min-w-0 items-center rounded-md text-[13px] transition-colors has-[button:first-child:focus-visible]:outline-2 has-[button:first-child:focus-visible]:outline-ring has-[button:first-child:focus-visible]:outline-offset-2",
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
          "inline-flex h-full min-w-0 items-center gap-1.5 rounded-md pl-3 font-medium outline-none [&_svg]:size-3.5",
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
          className="mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-black/5"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  );
}

export { Chip };
