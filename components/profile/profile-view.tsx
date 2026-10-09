"use client";

import { useEffect, useRef } from "react";
import { CoursesCard } from "@/components/profile/courses-card";
import { DataCard } from "@/components/profile/data-card";
import { ImportScreen } from "@/components/profile/import-screen";
import {
  PAGE_GRID,
  PageSkeleton,
  SIDE_PANEL,
} from "@/components/profile/layout";
import { ProgramCard } from "@/components/profile/program-card";
import { ReviewScreen } from "@/components/profile/review-screen";
import { useImportFlow } from "@/components/profile/use-import-flow";
import { COPY } from "@/lib/copy";
import { isStarted, startProfile } from "@/lib/profile/started";
import { useProfileHydrated, useProfileStore } from "@/lib/profile/store";
import { formatTerm } from "@/lib/profile/terms";
import { useProgram, useProgramIndex } from "@/lib/programs/client";

export function ProfileView() {
  const hydrated = useProfileHydrated();
  const flow = useImportFlow();
  const started = useProfileStore(isStarted);
  // Starts the program list download, so the picker and the transcript guess have it when they render.
  useProgramIndex();

  // The page renders after hydration, so the browser has already missed a #program or #graduation anchor on a full page load.
  useEffect(() => {
    if (hydrated) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, [hydrated]);

  // Cancelling a review drops the review screen, so keyboard focus goes back to the button that started it.
  const reviewed = useRef(false);
  useEffect(() => {
    if (flow.transcript) {
      reviewed.current = true;
    } else if (reviewed.current) {
      reviewed.current = false;
      document.querySelector<HTMLElement>("[data-import]")?.focus();
    }
  }, [flow.transcript]);

  if (!hydrated) {
    // Stands in until the saved profile has loaded, so a returning student never sees the import screen first.
    return <PageSkeleton status="Loading your profile" summary />;
  }
  if (flow.transcript) {
    return (
      <ReviewScreen
        transcript={flow.transcript}
        onCancel={flow.discardTranscript}
      />
    );
  }
  if (!started) return <ImportScreen flow={flow} onStartEmpty={startProfile} />;

  return (
    <div className="mx-auto w-full max-w-page px-8 py-12">
      <h1>Profile</h1>
      <Summary />
      <div className={PAGE_GRID}>
        <CoursesCard />
        <div className={SIDE_PANEL}>
          <ProgramCard />
          <DataCard flow={flow} />
        </div>
      </div>
    </div>
  );
}

/** "Computer Engineering (B.Eng.) with the Applied Artificial Intelligence minor, Fall 2025 to Winter 2029." */
function Summary() {
  const program = useProgram(useProfileStore((s) => s.programId));
  const minor = useProgram(useProfileStore((s) => s.minorId));
  const start = useProfileStore((s) => s.startTerm);
  const end = useProfileStore((s) => s.graduationTerm);
  const degree = program && `${program.name} (${program.degree})`;
  const terms =
    start && end
      ? `${formatTerm(start)} to ${formatTerm(end)}`
      : start
        ? `from ${formatTerm(start)}`
        : end && `until ${formatTerm(end)}`;
  const first = [
    [degree, minor && `with the ${COPY.minorTitle(minor.name)}`]
      .filter(Boolean)
      .join(" "),
    terms,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <p className="mt-2 text-fg-muted">
      {first && `${first[0]?.toUpperCase()}${first.slice(1)}. `}Kept in this
      browser only.
    </p>
  );
}
