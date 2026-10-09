import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { useId } from "react";
import { Term } from "@/components/ui/tooltip";
import type { Definition } from "@/lib/glossary";

/** The shared look of a text input or select: 36px tall, 8px radius, a 1px --fg-subtle edge. Add `w-full` or a width. */
const controlStyles =
  "h-9 rounded-md border border-fg-subtle bg-bg px-3 text-fg text-sm placeholder:text-fg-muted disabled:opacity-50";

/** The label, Body 600. With `info`, its words are a `Term` and `describedBy` holds the definition for the control. */
function FieldLabel({
  htmlFor,
  label,
  info,
  describedBy,
  hidden = false,
}: {
  htmlFor: string;
  label: string;
  info?: Definition;
  describedBy?: string;
  hidden?: boolean;
}) {
  return (
    <>
      <label
        htmlFor={htmlFor}
        className={cn("justify-self-start font-semibold", hidden && "sr-only")}
      >
        {info && !hidden ? <Term def={info}>{label}</Term> : label}
      </label>
      {info && describedBy && (
        <span id={describedBy} hidden>
          {info.tip}
        </span>
      )}
    </>
  );
}

const describedBy = (...ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;

/** A labelled select. `info` makes the label a `Term` with the definition. */
function SelectField({
  label,
  info,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & {
  label: string;
  info?: Definition;
}) {
  const id = useId();
  const infoId = useId();
  return (
    <div className={cn("grid gap-2", className)}>
      <FieldLabel
        htmlFor={props.id ?? id}
        label={label}
        info={info}
        describedBy={infoId}
      />
      <span className="relative">
        <select
          id={id}
          {...props}
          aria-describedby={describedBy(
            info && infoId,
            props["aria-describedby"],
          )}
          className={cn(controlStyles, "w-full appearance-none pr-9")}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
        />
      </span>
    </div>
  );
}

/** A labelled text input. `hint` is a line of help under it, `info` makes the label a `Term` with the definition. */
function TextField({
  label,
  hint,
  info,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  info?: Definition;
}) {
  const id = useId();
  const hintId = useId();
  const infoId = useId();
  return (
    <div className={cn("grid gap-2", className)}>
      <FieldLabel
        htmlFor={props.id ?? id}
        label={label}
        info={info}
        describedBy={infoId}
      />
      <input
        id={id}
        {...props}
        aria-describedby={describedBy(
          hint && hintId,
          info && infoId,
          props["aria-describedby"],
        )}
        className={cn(controlStyles, "w-full")}
      />
      {hint && (
        <span id={hintId} className="text-fg-muted">
          {hint}
        </span>
      )}
    </div>
  );
}

export { controlStyles, FieldLabel, SelectField, TextField };
