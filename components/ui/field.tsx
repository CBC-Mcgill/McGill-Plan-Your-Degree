import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { useId } from "react";
import { InfoTip } from "@/components/ui/tooltip";
import type { Definition } from "@/lib/glossary";

const control =
  "rounded-md bg-card px-3 text-foreground shadow-[inset_0_0_0_1px_var(--input)] placeholder:text-faint disabled:opacity-50";

/** The shared look of a text input or select: 36px tall, 8px radius, one hairline. Add `w-full` or a width. */
const controlStyles = `h-9 text-sm ${control}`;
const compactControlStyles = `h-8 text-[13px] ${control}`;

/** The label with its optional definition. The label is a sibling of the info button, so the button never joins the field's name. */
function FieldLabel({
  htmlFor,
  label,
  info,
  hidden = false,
}: {
  htmlFor: string;
  label: string;
  info?: Definition;
  hidden?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-1.5", hidden && "sr-only")}>
      <label
        htmlFor={htmlFor}
        className="font-medium text-[13px] leading-[18px]"
      >
        {label}
      </label>
      {info && !hidden && <InfoTip {...info} />}
    </span>
  );
}

/** `compact` is 32px and hides the label visually, for a select that sits in a row beside buttons. `info` adds a definition beside the label. */
function SelectField({
  label,
  info,
  compact = false,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & {
  label: string;
  info?: Definition;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("grid gap-1.5", className)}>
      <FieldLabel
        htmlFor={props.id ?? id}
        label={label}
        info={info}
        hidden={compact}
      />
      <span className="relative">
        <select
          id={id}
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
    </div>
  );
}

/** `hint` is a line of help under the input. `info` adds a definition beside the label. */
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
  return (
    <div className={cn("grid gap-1.5", className)}>
      <FieldLabel htmlFor={props.id ?? id} label={label} info={info} />
      <input
        id={id}
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
    </div>
  );
}

export {
  compactControlStyles,
  controlStyles,
  FieldLabel,
  SelectField,
  TextField,
};
