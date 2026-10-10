"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CatalogueLink } from "@/components/external-link";
import { GeneratedNote } from "@/components/generated-banner";
import { PHONE_FIELDS } from "@/components/profile/layout";
import { ProgramCombobox } from "@/components/profile/program-combobox";
import { EntrySelect, TermSelect } from "@/components/profile/selects";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { degreeCredits, standingCredits } from "@/lib/engine/credits";
import { GLOSSARY } from "@/lib/glossary";
import { currentTerm } from "@/lib/profile/terms";
import type { EntryRoute, Term } from "@/lib/profile/types";
import { useProgram } from "@/lib/programs/client";
import type { Program } from "@/lib/programs/types";

export interface ProgramValues {
  programId: string | null;
  minorId: string | null;
  startTerm: Term | null;
  graduationTerm: Term | null;
  entry: EntryRoute | null;
  advancedStanding: number;
  creditsRequired: number | null;
}

/** The fields that describe a student's program, shared by the profile and the transcript review. `detected` is what the transcript names, shown on the Program label. */
export function ProgramFields({
  value,
  onChange,
  detected,
}: {
  value: ProgramValues;
  onChange: (patch: Partial<ProgramValues>) => void;
  detected?: string;
}) {
  // Null credits mean "use the default", so the field only holds what the student typed.
  const program = useProgram(value.programId);
  const minor = useProgram(value.minorId);
  const defaultCredits = degreeCredits(null, value.entry, program ?? null);
  // A number that only repeats the old default would be wrong for the new program or entry.
  const changeProgramOrEntry = (patch: Partial<ProgramValues>) =>
    onChange(
      value.creditsRequired === defaultCredits
        ? { creditsRequired: null, ...patch }
        : patch,
    );

  return (
    <div className={`grid grid-cols-2 items-start gap-4 ${PHONE_FIELDS}`}>
      <div className="col-span-2">
        <ProgramCombobox
          value={value.programId}
          onChange={(programId) => changeProgramOrEntry({ programId })}
          info={
            detected
              ? { label: "Program", tip: `On your transcript: ${detected}` }
              : undefined
          }
        />
        {program?.generated && <GeneratedLine program={program} />}
      </div>
      <div className="col-span-2">
        <ProgramCombobox
          kind="minor"
          value={value.minorId}
          onChange={(minorId) => onChange({ minorId })}
        />
        {minor?.generated && <GeneratedLine program={minor} />}
      </div>
      <TermSelect
        label="Start term"
        className="max-md:col-span-2"
        value={value.startTerm}
        onChange={(startTerm) => onChange({ startTerm })}
      />
      <TermSelect
        id="graduation"
        className="max-md:col-span-2"
        label="Expected graduation"
        info={GLOSSARY.graduation}
        notBefore={currentTerm()}
        value={value.graduationTerm}
        onChange={(graduationTerm) => onChange({ graduationTerm })}
      />
      <EntrySelect
        info={GLOSSARY.entry}
        className="col-span-2"
        value={value.entry}
        onChange={(entry) => changeProgramOrEntry({ entry })}
      />
      <Credits
        value={value}
        onChange={onChange}
        defaultCredits={program === undefined ? undefined : defaultCredits}
        standing={standingCredits(
          value.advancedStanding,
          value.entry,
          program ?? null,
        )}
      />
    </div>
  );
}

/** "Read automatically from the catalogue · McGill catalogue" under a crawled program or minor (D39). */
function GeneratedLine({ program }: { program: Program }) {
  const hasChecks = program.groups.some(
    (group) =>
      group.kind === "complementary" &&
      group.rules.some((rule) => rule.unparsed),
  );
  return (
    <p className="mt-2 text-fg-muted">
      <GeneratedNote hasChecks={hasChecks} />{" "}
      <span className="whitespace-nowrap">
        · <CatalogueLink href={program.source} />
      </span>
    </p>
  );
}

/** The two credit settings are set once, so a summary line shows their values and Edit opens the fields (pattern B). `defaultCredits` is undefined while the program loads. */
function Credits({
  value,
  onChange,
  defaultCredits,
  standing,
}: {
  value: ProgramValues;
  onChange: (patch: Partial<ProgramValues>) => void;
  defaultCredits: number | null | undefined;
  /** The advanced standing the degree counts, at least the credited Year 0. */
  standing: number;
}) {
  const [open, setOpen] = useState(false);
  const fieldsId = useId();
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);

  const required =
    value.creditsRequired !== null
      ? `${value.creditsRequired} required`
      : defaultCredits === undefined
        ? null
        : defaultCredits === null
          ? "total not set"
          : `${defaultCredits} required (from your program)`;

  return (
    <div className="col-span-2">
      <div className="flex items-center justify-between gap-4">
        <p className="tabular-nums">
          Credits:{" "}
          {[
            required,
            standing > value.advancedStanding
              ? `${standing} advanced standing (Year 0 from CEGEP)`
              : `${standing} advanced standing`,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        <Button
          variant="secondary"
          aria-expanded={open}
          aria-controls={fieldsId}
          onClick={() => setOpen(!open)}
          className="-my-2 max-md:h-11"
        >
          Edit
        </Button>
      </div>
      <div
        id={fieldsId}
        hidden={!open}
        className="mt-4 grid grid-cols-2 items-start gap-4 max-md:grid-cols-1"
      >
        <TextField
          ref={first}
          label="Advanced standing credits"
          info={GLOSSARY.advancedStanding}
          type="number"
          min={0}
          max={60}
          placeholder="0"
          value={value.advancedStanding || ""}
          onChange={(event) =>
            onChange({
              advancedStanding: Math.max(
                0,
                Math.min(60, Number(event.target.value)),
              ),
            })
          }
        />
        <TextField
          label="Credits required for your degree"
          info={GLOSSARY.creditsRequired}
          type="number"
          min={1}
          max={200}
          placeholder={defaultCredits ? String(defaultCredits) : "Optional"}
          value={value.creditsRequired ?? ""}
          onChange={(event) => {
            const credits = Number(event.target.value);
            onChange({
              creditsRequired: credits >= 1 ? Math.min(200, credits) : null,
            });
          }}
        />
      </div>
    </div>
  );
}
