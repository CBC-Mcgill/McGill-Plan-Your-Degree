"use client";

import type * as React from "react";
import { SelectField } from "@/components/ui/field";
import { currentTerm, formatTerm, termRange } from "@/lib/profile/terms";
import { type Term, termFromKey, termKey } from "@/lib/profile/types";
import { PROGRAMS } from "@/lib/programs";

type SelectProps = Omit<
  React.ComponentProps<typeof SelectField>,
  "label" | "value" | "onChange" | "children"
>;

/** The empty value is the choice for a program that is not in the list. */
export function ProgramSelect({
  value,
  onChange,
  ...props
}: {
  value: string | null;
  onChange: (programId: string | null) => void;
} & SelectProps) {
  return (
    <SelectField
      {...props}
      label="Program"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    >
      {PROGRAMS.map((program) => (
        <option key={program.id} value={program.id}>
          {program.name} ({program.degree})
        </option>
      ))}
      <option value="">My program isn't listed yet</option>
    </SelectField>
  );
}

/** Terms from ten years back to eight years ahead, plus the current value. */
export function TermSelect({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: Term | null;
  onChange: (term: Term | null) => void;
} & SelectProps) {
  const year = currentTerm().year;
  return (
    <SelectField
      {...props}
      label={label}
      value={value ? termKey(value) : ""}
      onChange={(event) =>
        onChange(
          event.target.value ? termFromKey(Number(event.target.value)) : null,
        )
      }
    >
      <option value="">Not set</option>
      {termRange(year - 10, year + 8, [value]).map((term) => (
        <option key={termKey(term)} value={termKey(term)}>
          {formatTerm(term)}
        </option>
      ))}
    </SelectField>
  );
}
