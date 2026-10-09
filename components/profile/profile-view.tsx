"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CoursesCard } from "@/components/profile/courses-card";
import { DataCard } from "@/components/profile/data-card";
import { ImportNotice } from "@/components/profile/import-notice";
import { ImportScreen } from "@/components/profile/import-screen";
import { ProgramCard } from "@/components/profile/program-card";
import { ReviewScreen } from "@/components/profile/review-screen";
import { useImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isStarted, startProfile } from "@/lib/profile/started";
import { useProfileHydrated, useProfileStore } from "@/lib/profile/store";
import { useProgramIndex } from "@/lib/programs/client";

export function ProfileView() {
  const hydrated = useProfileHydrated();
  const flow = useImportFlow();
  const started = useProfileStore(isStarted);
  // Starts the program list download, so the picker and the transcript guess have it when they render.
  useProgramIndex();

  // The page renders after hydration, so the browser has already missed a #program anchor on a full page load.
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
    <div className="mx-auto w-full max-w-page px-8 py-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1>Your profile</h1>
          <p className="mt-1 text-muted-foreground">
            Your program and courses, kept in this browser.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/next">
            See what's next
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="mt-5 empty:hidden">
        <ImportNotice reading={flow.reading} notice={flow.notice} />
      </div>

      <div className="mt-6 flex flex-col gap-8">
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
    <div className="mx-auto w-full max-w-page px-8 py-10">
      <div aria-hidden className="flex flex-col gap-1">
        <div className="h-[34px] w-44 rounded-sm bg-muted motion-safe:animate-pulse" />
        <div className="h-5 w-80 rounded-sm bg-muted motion-safe:animate-pulse" />
      </div>
      <p role="status" className="sr-only">
        Loading your profile
      </p>
      <div aria-hidden className="mt-6 flex flex-col gap-8">
        <Card className="h-60" />
        <Card className="h-96" />
      </div>
    </div>
  );
}
