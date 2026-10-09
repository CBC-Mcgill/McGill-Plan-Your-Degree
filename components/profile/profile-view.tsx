"use client";

import { useEffect, useRef } from "react";
import { CoursesCard } from "@/components/profile/courses-card";
import { DataCard } from "@/components/profile/data-card";
import { ImportScreen } from "@/components/profile/import-screen";
import { ProgramCard } from "@/components/profile/program-card";
import { ReviewScreen } from "@/components/profile/review-screen";
import { useImportFlow } from "@/components/profile/use-import-flow";
import { isStarted, startProfile } from "@/lib/profile/started";
import { useProfileHydrated, useProfileStore } from "@/lib/profile/store";
import { useProgramIndex } from "@/lib/programs/client";

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

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

  if (!hydrated) return <ProfileSkeleton />;
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
      <div className="flex max-w-reading flex-col gap-6">
        <h1 className="sr-only">Profile</h1>
        <ProgramCard />
        <CoursesCard />
        <DataCard flow={flow} />
      </div>
    </div>
  );
}

/** Stands in until the saved profile has loaded, so a returning student never sees the import screen first. */
function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-page px-8 py-12">
      <p role="status" className="sr-only">
        Loading your profile
      </p>
      <div aria-hidden className="max-w-reading">
        <div className={`${bone} h-7 w-28`} />
        <div className={`${bone} mt-2 h-5 w-56`} />
        <div className={`${bone} mt-4 h-9`} />
        <div className={`${bone} mt-4 h-9`} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className={`${bone} h-9`} />
          <div className={`${bone} h-9`} />
        </div>
        <div className={`${bone} mt-12 h-7 w-28`} />
        {Array.from({ length: 5 }, (_, row) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
          <div key={row} className={`${bone} mt-4 h-7`} />
        ))}
      </div>
    </div>
  );
}
