"use client";

import { ProgramSelect, TermSelect } from "@/components/profile/selects";
import { useProfileStore } from "@/lib/profile/store";

export function ProgramCard() {
  const programId = useProfileStore((s) => s.programId);
  const startTerm = useProfileStore((s) => s.startTerm);
  const graduationTerm = useProfileStore((s) => s.graduationTerm);
  const setProgram = useProfileStore((s) => s.setProgram);
  const setTerms = useProfileStore((s) => s.setTerms);

  return (
    <section className="rounded-lg border-2 border-border bg-card p-6">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="text-xl">Your program</h2>
        <p className="text-muted-foreground text-sm">
          Changes are saved as you make them.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
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
    </section>
  );
}
