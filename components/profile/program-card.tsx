"use client";

import { useShallow } from "zustand/react/shallow";
import { ProgramFields } from "@/components/profile/program-fields";
import { SettingsSection } from "@/components/profile/settings-section";
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
    <SettingsSection
      id="program"
      title="Your program"
      description="Your program and dates set what you still need, and changes save as you make them."
    >
      <ProgramFields
        value={value}
        onChange={(patch) => useProfileStore.setState(patch)}
      />
    </SettingsSection>
  );
}
