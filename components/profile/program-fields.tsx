import { GeneratedBanner } from "@/components/generated-banner";
import { ProgramCombobox } from "@/components/profile/program-combobox";
import { EntrySelect, TermSelect } from "@/components/profile/selects";
import { TextField } from "@/components/ui/field";
import { degreeCredits } from "@/lib/engine/credits";
import { GLOSSARY } from "@/lib/glossary";
import { currentTerm } from "@/lib/profile/terms";
import type { EntryRoute, Term } from "@/lib/profile/types";
import { useProgram } from "@/lib/programs/client";

export interface ProgramValues {
  programId: string | null;
  startTerm: Term | null;
  graduationTerm: Term | null;
  entry: EntryRoute | null;
  advancedStanding: number;
  creditsRequired: number | null;
}

/** The six fields that describe a student's program, shared by the profile and the transcript review. */
export function ProgramFields({
  value,
  onChange,
}: {
  value: ProgramValues;
  onChange: (patch: Partial<ProgramValues>) => void;
}) {
  // Null credits mean "use the default", so the field only holds what the student typed.
  const program = useProgram(value.programId);
  const defaultCredits = degreeCredits(null, value.entry, program ?? null);
  // A number that only repeats the old default would be wrong for the new program or entry.
  const changeProgramOrEntry = (patch: Partial<ProgramValues>) =>
    onChange(
      value.creditsRequired === defaultCredits
        ? { creditsRequired: null, ...patch }
        : patch,
    );

  return (
    <div className="grid grid-cols-2 items-start gap-4">
      <ProgramCombobox
        className="col-span-2"
        value={value.programId}
        onChange={(programId) => changeProgramOrEntry({ programId })}
      />
      {program && <GeneratedBanner program={program} className="col-span-2" />}
      <TermSelect
        label="Start term"
        info={GLOSSARY.startTerm}
        value={value.startTerm}
        onChange={(startTerm) => onChange({ startTerm })}
      />
      <TermSelect
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
      <TextField
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
        placeholder={
          program === undefined
            ? ""
            : defaultCredits === null
              ? "Optional"
              : String(defaultCredits)
        }
        hint={
          value.creditsRequired === null && defaultCredits !== null
            ? "From your program"
            : undefined
        }
        value={value.creditsRequired ?? ""}
        onChange={(event) => {
          const credits = Number(event.target.value);
          onChange({
            creditsRequired: credits >= 1 ? Math.min(200, credits) : null,
          });
        }}
      />
    </div>
  );
}
