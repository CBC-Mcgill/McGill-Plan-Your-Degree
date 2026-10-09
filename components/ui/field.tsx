import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { useId } from "react";

const control =
  "rounded-md bg-card px-3 text-foreground shadow-[inset_0_0_0_1px_var(--input)] placeholder:text-faint disabled:opacity-50";

/** The shared look of a text input or select: 36px tall, 8px radius, one hairline. Add `w-full` or a width. */
const controlStyles = `h-9 text-sm ${control}`;
const compactControlStyles = `h-8 text-[13px] ${control}`;

/** `compact` is 32px and hides the label visually, for a select that sits in a row beside buttons. */
function SelectField({
  label,
  compact = false,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string; compact?: boolean }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span
        className={cn(
          "font-medium text-[13px] leading-[18px]",
          compact && "sr-only",
        )}
      >
        {label}
      </span>
      <span className="relative">
        <select
          {...props}
          className={cn(
            compact ? compactControlStyles : controlStyles,
            "w-full appearance-none pr-9",
          )}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}

/** `hint` is a line of help under the input. */
function TextField({
  label,
  hint,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  const hintId = useId();
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="font-medium text-[13px] leading-[18px]">{label}</span>
      <input
        {...props}
        aria-describedby={hint ? hintId : props["aria-describedby"]}
        className={cn(controlStyles, "w-full")}
      />
      {hint && (
        <span
          id={hintId}
          className="text-[13px] text-muted-foreground leading-[18px]"
        >
          {hint}
        </span>
      )}
    </label>
  );
}

export { compactControlStyles, controlStyles, SelectField, TextField };
