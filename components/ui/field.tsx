import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import type * as React from "react";

const control =
  "h-12 w-full rounded-md border-2 border-border-strong bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-50";

function SelectField({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="font-semibold text-sm">{label}</span>
      <span className="relative">
        <select {...props} className={cn(control, "appearance-none pr-11")}>
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  className,
  ...props
}: React.ComponentProps<"input"> & { label: string }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="font-semibold text-sm">{label}</span>
      <input {...props} className={control} />
    </label>
  );
}

export { SelectField, TextField };
