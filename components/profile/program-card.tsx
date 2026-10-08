"use client";

import {
  EntrySelect,
  ProgramSelect,
  TermSelect,
} from "@/components/profile/selects";
import { TextField } from "@/components/ui/field";
import { useProfileStore } from "@/lib/profile/store";

const grid =
  "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4";

export function ProgramCard() {
  const programId = useProfileStore((s) => s.programId);
  const startTerm = useProfileStore((s) => s.startTerm);
  const graduationTerm = useProfileStore((s) => s.graduationTerm);
  const entry = useProfileStore((s) => s.entry);
  const advancedStanding = useProfileStore((s) => s.advancedStanding);
  const creditsRequired = useProfileStore((s) => s.creditsRequired);
  const setProgram = useProfileStore((s) => s.setProgram);
  const setTerms = useProfileStore((s) => s.setTerms);
  const setBackground = useProfileStore((s) => s.setBackground);

  return (
    <section className="rounded-lg border-2 border-border bg-card p-6">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="text-xl">Your program</h2>
        <p className="text-muted-foreground text-sm">
          Changes are saved as you make them.
        </p>
      </div>
      <div className={`mt-4 ${grid}`}>
        <ProgramSelect value={programId} onChange={setProgram} />
        <TermSelect
          label="Start term"
          value={startTerm}
          onChange={(term) => setTerms({ startTerm: term })}
        />
        <TermSelect
          label="Expected graduation"
          value={graduationTerm}
          onChange={(term) => setTerms({ graduationTerm: term })}
        />
      </div>
      <div className={`mt-4 ${grid}`}>
        <EntrySelect
          value={entry}
          onChange={(value) => setBackground({ entry: value })}
        />
        <TextField
          label="Advanced standing credits"
          type="number"
          min={0}
          max={60}
          placeholder="0"
          value={advancedStanding || ""}
          onChange={(event) =>
            setBackground({
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
          value={creditsRequired ?? ""}
          onChange={(event) => {
            const credits = Number(event.target.value);
            setBackground({
              creditsRequired: credits >= 1 ? Math.min(200, credits) : null,
            });
          }}
        />
      </div>
    </section>
  );
}
