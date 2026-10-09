import { cn } from "cn";
import { ChevronDown, X } from "lucide-react";
import type * as React from "react";

/** A filter as a 36px text button. Empty, it reads "Subject" with a chevron. Set, it reads "Subject: COMP" and gains a clear button. */
function Chip({
  label,
  value,
  onClear,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  label: string;
  value?: string;
  onClear?: () => void;
}) {
  const clear = Boolean(value && onClear);
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-0 items-center rounded-md hover:bg-tint has-[button:first-child:focus-visible]:outline-2 has-[button:first-child:focus-visible]:outline-ring has-[button:first-child:focus-visible]:outline-offset-2",
        className,
      )}
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-full min-w-0 items-center gap-2 rounded-md pl-3 outline-none",
          clear ? "pr-1" : "pr-3",
          value ? "font-semibold text-fg" : "text-fg-muted",
        )}
        {...props}
      >
        <span className="truncate">{value ? `${label}: ${value}` : label}</span>
        {!value && <ChevronDown aria-hidden className="size-4 shrink-0" />}
      </button>
      {clear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label}`}
          className="mr-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted hover:text-fg"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </span>
  );
}

export { Chip };
