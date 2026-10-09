"use client";

import type * as React from "react";
import { SelectField } from "@/components/ui/field";
import { currentTerm, formatTerm, termRange } from "@/lib/profile/terms";
import {
  type EntryRoute,
  type Term,
  termFromKey,
  termKey,
} from "@/lib/profile/types";
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

/** The empty value is "Not sure", for a student who cannot say how they started. */
export function EntrySelect({
  value,
  onChange,
  ...props
}: {
  value: EntryRoute | null;
  onChange: (entry: EntryRoute | null) => void;
} & SelectProps) {
  return (
    <SelectField
      {...props}
      label="How you started at McGill"
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value ? (event.target.value as EntryRoute) : null)
      }
    >
      <option value="cegep">Quebec CEGEP (DEC), started in U1</option>
      <option value="foundation">
        Outside Quebec, started in U0 (Foundation year)
      </option>
      <option value="">Not sure</option>
    </SelectField>
  );
}

/** Terms from ten years back to eight years ahead, plus the current value. `notBefore` leaves out earlier terms. */
export function TermSelect({
  label,
  value,
  notBefore,
  onChange,
  ...props
}: {
  label: string;
  value: Term | null;
  notBefore?: Term;
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
      {termRange(year - 10, year + 8, [value])
        .filter(
          (term) =>
            !notBefore ||
            termKey(term) >= termKey(notBefore) ||
            termKey(term) === (value && termKey(value)),
        )
        .map((term) => (
          <option key={termKey(term)} value={termKey(term)}>
            {formatTerm(term)}
          </option>
        ))}
    </SelectField>
  );
}
