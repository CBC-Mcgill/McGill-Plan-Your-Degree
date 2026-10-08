"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BadgesCard } from "@/components/profile/badges-card";
import { CoursesCard } from "@/components/profile/courses-card";
import { DataCard } from "@/components/profile/data-card";
import { ImportNotice } from "@/components/profile/import-notice";
import { ImportScreen } from "@/components/profile/import-screen";
import { ProgramCard } from "@/components/profile/program-card";
import { ReviewScreen } from "@/components/profile/review-screen";
import { useImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
import { useProfileHydrated, useProfileStore } from "@/lib/profile/store";

export function ProfileView() {
  const hydrated = useProfileHydrated();
  const flow = useImportFlow();
  const hasProfile = useProfileStore(
    (s) => s.records.length > 0 || s.programId !== null,
  );
  // "Start without a transcript" shows the empty profile, so the program can be set first.
  const [started, setStarted] = useState(false);

  if (!hydrated) return <div className="flex-1" />;
  if (flow.transcript) {
    return (
      <ReviewScreen
        transcript={flow.transcript}
        onCancel={flow.discardTranscript}
      />
    );
  }
  if (!hasProfile && !started) {
    return <ImportScreen flow={flow} onStartEmpty={() => setStarted(true)} />;
  }

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
        <BadgesCard />
        <CoursesCard />
        <DataCard flow={flow} onReset={() => setStarted(false)} />
      </div>
    </div>
  );
}
