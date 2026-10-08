import {
  EntrySelect,
  ProgramSelect,
  TermSelect,
} from "@/components/profile/selects";
import { TextField } from "@/components/ui/field";
import type { EntryRoute, Term } from "@/lib/profile/types";

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
  return (
    <div className="grid grid-cols-2 gap-4">
      <ProgramSelect
        className="col-span-2"
        value={value.programId}
        onChange={(programId) => onChange({ programId })}
      />
      <TermSelect
        label="Start term"
        value={value.startTerm}
        onChange={(startTerm) => onChange({ startTerm })}
      />
      <TermSelect
        label="Expected graduation"
        value={value.graduationTerm}
        onChange={(graduationTerm) => onChange({ graduationTerm })}
      />
      <EntrySelect
        className="col-span-2"
        value={value.entry}
        onChange={(entry) => onChange({ entry })}
      />
      <TextField
        label="Advanced standing credits"
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
        type="number"
        min={1}
        max={200}
        placeholder="Optional"
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
