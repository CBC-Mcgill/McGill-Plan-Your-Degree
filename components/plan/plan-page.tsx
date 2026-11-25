"use client";

import { cn } from "cn";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { NoProfile } from "@/components/no-profile";
import { PlanSummary } from "@/components/plan/plan-summary";
import { Requirements } from "@/components/plan/requirements";
import { Terms } from "@/components/plan/terms";
import { ViewTabs } from "@/components/ui/tabs";
import { useCatalogue } from "@/lib/catalogue/client";
import { planWarnings } from "@/lib/engine/plan";
import { programStanding, secondOverlaps } from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { useProfileStore } from "@/lib/profile/store";
import { currentTerm, termLabel } from "@/lib/profile/term-options";
import { compareTerms, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram, useSeconds } from "@/lib/programs/client";
import type { Program } from "@/lib/programs/types";

type View = "requirements" | "terms";

const VIEWS: { id: View; label: string }[] = [
  { id: "requirements", label: "Requirements" },
  { id: "terms", label: "Terms" },
];

/** The plan: one header, then what the degree still needs or the terms to graduation. Without a profile it offers to import a transcript. */
export function PlanPage() {
  const snapshot = useSnapshot();
  if (snapshot === undefined) return <PlanSkeleton />;
  if (snapshot === null) {
    return (
      <NoProfile
        title="See what you can take next"
        lede="Import your unofficial transcript to see the courses you can take next term, what you still need to graduate and a plan for every term until then."
        sample="next"
      />
    );
  }
  return <WithCatalogue snapshot={snapshot} />;
}

// Split out so a visitor without a profile does not download the catalogue.
function WithCatalogue({ snapshot }: { snapshot: Snapshot }) {
  const catalogue = useCatalogue();
  const programId = useProfileStore((state) => state.programId);
  const program = useProgram(programId);
  const seconds = useSeconds();

  if (catalogue.status === "error") {
    return (
      <>
        <h1 className="sr-only">Plan</h1>
        <CatalogueError />
      </>
    );
  }
  if (
    catalogue.status !== "ready" ||
    program === undefined ||
    seconds === undefined
  ) {
    return <PlanSkeleton />;
  }
  return (
    <Ready
      snapshot={snapshot}
      catalogue={catalogue.catalogue}
      program={program}
      seconds={seconds}
    />
  );
}

function Ready({
  snapshot,
  catalogue,
  program,
  seconds,
}: {
  snapshot: Snapshot;
  catalogue: Catalogue;
  program: Program | null;
  seconds: readonly Program[];
}) {
  const plan = useProfileStore((state) => state.plan);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const entry = useProfileStore((state) => state.entry);
  const params = useSearchParams();
  const view: View = params.get("view") === "terms" ? "terms" : "requirements";
  // A toast's "View term" link names the term to open.
  const linked = params.get("term");
  const [picked, setPicked] = useState<number | null>(
    linked ? Number(linked) : null,
  );
  const [seen, setSeen] = useState(linked);
  if (linked !== seen) {
    setSeen(linked);
    if (linked) setPicked(Number(linked));
  }
  useEffect(() => {
    if (linked) document.getElementById("term-heading")?.focus();
  }, [linked]);
  const panelId = useId();
  // Show warnings switches view, and the term card renders a render after the URL changes, so focus waits for it.
  const focusTerm = useRef(false);
  useEffect(() => {
    if (!focusTerm.current || view !== "terms") return;
    focusTerm.current = false;
    document.getElementById("term-heading")?.focus();
  });

  const now = useMemo(() => currentTerm(), []);
  const warnings = useMemo(
    () => planWarnings(plan, snapshot, catalogue, creditLimit, graduationTerm),
    [plan, snapshot, catalogue, creditLimit, graduationTerm],
  );
  const progress = useMemo(
    () =>
      program
        ? programStanding(program, snapshot, catalogue, entry, "plan")
        : null,
    [program, snapshot, catalogue, entry],
  );
  const secondStandings = useMemo(() => {
    const overlaps = secondOverlaps(
      seconds,
      program,
      snapshot,
      catalogue,
      entry,
      "plan",
    );
    return seconds.map((second, i) => ({
      program: second,
      progress: programStanding(
        second,
        snapshot,
        catalogue,
        entry,
        "plan",
        overlaps[i]?.programOnly,
      ),
    }));
  }, [seconds, program, snapshot, catalogue, entry]);

  function show(next: View) {
    // A view is a tab of one page, so switching replaces the entry instead of adding one per arrow press.
    window.history.replaceState(
      null,
      "",
      next === "terms" ? "?view=terms" : window.location.pathname,
    );
  }

  function showWarnings() {
    const first = Math.min(...warnings.map((warning) => termKey(warning.term)));
    setPicked(first);
    focusTerm.current = true;
    if (view !== "terms") show("terms");
  }

  return (
    <>
      <PlanSummary
        standing={program && progress ? { program, progress } : null}
        seconds={secondStandings}
        snapshot={snapshot}
        warningCount={warnings.length}
        onShowWarnings={showWarnings}
        graduationPassed={
          graduationTerm && compareTerms(graduationTerm, now) < 0
            ? termLabel(graduationTerm)
            : null
        }
      />
      <div className="mt-6 max-md:[&_[role=tab]]:flex-auto max-md:[&_[role=tablist]]:w-full max-lg:[&_[role=tab]]:h-10 max-lg:[&_[role=tablist]]:h-11">
        <ViewTabs
          label="View"
          tabs={VIEWS}
          value={view}
          onChange={show}
          panelId={panelId}
        />
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${panelId}-${view}`}
        className="mt-6"
      >
        {view === "terms" ? (
          <Terms
            snapshot={snapshot}
            catalogue={catalogue}
            program={program}
            progress={progress}
            warnings={warnings}
            picked={picked}
            onPick={setPicked}
          />
        ) : (
          <Requirements
            snapshot={snapshot}
            catalogue={catalogue}
            program={program}
            seconds={seconds}
            withPlan={progress}
            secondsWithPlan={secondStandings.map(({ progress }) => progress)}
          />
        )}
      </div>
    </>
  );
}

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

/** The header, the view switch and the Requirements view, the default, while the profile and catalogue load. */
function PlanSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading your plan</span>
      <div aria-hidden>
        <div className={cn(bone, "h-11 w-[400px] max-md:max-w-full")} />
        <div className={cn(bone, "mt-2 h-5 w-[480px] max-md:max-w-full")} />
        <div className={cn(bone, "mt-4 h-1.5 w-80 max-md:w-full")} />
        <div className={cn(bone, "mt-6 h-9 w-56 max-md:h-11 max-md:w-full")} />
        <div className={cn(bone, "mt-6 h-5 w-[520px] max-md:max-w-full")} />
        <div className="mt-6 grid grid-cols-[15rem_minmax(0,1fr)] gap-6 max-lg:block">
          <div className="flex flex-col gap-1">
            {Array.from({ length: 6 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              <div key={row} className={cn(bone, "h-14")} />
            ))}
          </div>
          <div className="max-lg:hidden">
            <div className={cn(bone, "h-7 w-64")} />
            <div className="mt-4">
              {Array.from({ length: 6 }, (_, row) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
                <div key={row} className="flex h-11 items-center gap-4">
                  <div className={cn(bone, "h-5 w-24")} />
                  <div className={cn(bone, "h-5 flex-1")} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
