"use client";

import { useShallow } from "zustand/react/shallow";
import { ProgramFields } from "@/components/profile/program-fields";
import { Section } from "@/components/ui/section";
import { useProfileStore } from "@/lib/profile/store";

export function ProgramCard() {
  const value = useProfileStore(
    useShallow((s) => ({
      programId: s.programId,
      minorId: s.minorId,
      startTerm: s.startTerm,
      graduationTerm: s.graduationTerm,
      entry: s.entry,
      advancedStanding: s.advancedStanding,
      creditsRequired: s.creditsRequired,
    })),
  );

  return (
    <Section id="program" title="Degree">
      <ProgramFields
        value={value}
        onChange={(patch) => useProfileStore.setState(patch)}
      />
    </Section>
  );
}
