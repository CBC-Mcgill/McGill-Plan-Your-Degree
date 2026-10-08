"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseRow, TermGroup } from "@/components/profile/course-row";
import {
  EntrySelect,
  ProgramSelect,
  TermSelect,
} from "@/components/profile/selects";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useCatalogue } from "@/lib/catalogue/client";
import { useProfileStore } from "@/lib/profile/store";
import { groupByTerm, guessGraduation } from "@/lib/profile/terms";
import {
  compareTerms,
  type EntryRoute,
  isCegep,
  logicalCode,
  type Term,
  termKey,
} from "@/lib/profile/types";
import { guessProgram } from "@/lib/programs";
import type { Transcript } from "@/lib/transcript/parse";

const COUNTS_TOWARD_CREDITS = ["completed", "transfer", "in-progress"];

export function ReviewScreen({
  transcript,
  onCancel,
}: {
  transcript: Transcript;
  onCancel: () => void;
}) {
  const router = useRouter();
  const catalogue = useCatalogue();
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [programId, setProgramId] = useState(
    () =>
      guessProgram(transcript.degree, transcript.programs) ??
      useProfileStore.getState().programId,
  );
  const [entry, setEntry] = useState<EntryRoute | null>(() =>
    isCegep(transcript.previousEducation)
      ? "cegep"
      : useProfileStore.getState().entry,
  );
  const [advancedStanding, setAdvancedStanding] = useState(
    transcript.advancedStanding,
  );
  const [creditsRequired, setCreditsRequired] = useState<number | null>(
    () =>
      transcript.creditsRequired ?? useProfileStore.getState().creditsRequired,
  );
  const [startTerm, setStartTerm] = useState<Term | null>(
    () => earliest(transcript) ?? useProfileStore.getState().startTerm,
  );
  const [graduationTerm, setGraduationTerm] = useState<Term | null>(
    () =>
      useProfileStore.getState().graduationTerm ??
      guessGraduationTerm(transcript),
  );

  const kept = transcript.courses.flatMap((course, index) =>
    removed.has(index) ? [] : [{ course, index, term: course.term }],
  );
  const groups = groupByTerm(kept);
  const termCount = groups.filter((g) => g.term).length;
  const titleOf = (code: string) => {
    const known =
      catalogue.status === "ready"
        ? catalogue.catalogue.get(logicalCode(code))
        : undefined;
    return { known, missing: catalogue.status === "ready" && !known };
  };
  const missingCount = kept.filter(
    ({ course }) => titleOf(course.code).missing,
  ).length;
  const detected = [
    transcript.degree,
    ...transcript.programs,
    ...transcript.minors,
  ].filter(Boolean);
  const background = [
    isCegep(transcript.previousEducation)
      ? "Quebec CEGEP"
      : transcript.previousEducation,
    transcript.advancedStanding > 0 &&
      `${transcript.advancedStanding} advanced standing credits`,
  ]
    .filter(Boolean)
    .join(" · ");

  function save() {
    const store = useProfileStore.getState();
    store.applyTranscript({
      ...transcript,
      courses: kept.map(({ course }) => course),
    });
    store.setProgram(programId);
    store.setBackground({ entry, advancedStanding, creditsRequired });
    store.setTerms({ startTerm, graduationTerm });
    router.push("/next");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 px-8 pt-12 pb-10">
        <h1
          ref={(element) => element?.focus()}
          tabIndex={-1}
          className="text-4xl focus:outline-none"
        >
          Check your transcript
        </h1>
        <p className="mt-3 max-w-prose text-lg text-muted-foreground">
          Nothing is saved until you choose Save to my profile.
        </p>

        <section className="mt-8 rounded-lg border-2 border-border bg-card p-6">
          <div className="flex items-baseline justify-between gap-6">
            <h2 className="text-2xl">
              {kept.length} {kept.length === 1 ? "course" : "courses"} across{" "}
              {termCount} {termCount === 1 ? "term" : "terms"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {detected.length > 0
                ? `Found: ${detected.join(", ")}`
                : "We could not find a program on this transcript."}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
            <ProgramSelect value={programId} onChange={setProgramId} />
            <TermSelect
              label="Start term"
              value={startTerm}
              onChange={setStartTerm}
            />
            <TermSelect
              label="Expected graduation"
              value={graduationTerm}
              onChange={setGraduationTerm}
            />
          </div>
          <div className="mt-4 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-4">
            <EntrySelect value={entry} onChange={setEntry} />
            <TextField
              label="Advanced standing credits"
              type="number"
              min={0}
              max={60}
              placeholder="0"
              value={advancedStanding || ""}
              onChange={(event) =>
                setAdvancedStanding(
                  Math.max(0, Math.min(60, Number(event.target.value))),
                )
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
                setCreditsRequired(
                  credits >= 1 ? Math.min(200, credits) : null,
                );
              }}
            />
          </div>
          {background && (
            <p className="mt-3 text-muted-foreground text-sm">
              Found on your transcript: {background}
            </p>
          )}
          {programId === null && (
            <p className="mt-3 text-muted-foreground text-sm">
              Your courses are still saved. Requirements can't be tracked for
              this program yet.
            </p>
          )}
        </section>

        <div className="mt-8 grid gap-7">
          {missingCount > 0 && (
            <p className="flex items-start gap-2.5 rounded-md border-2 border-available/30 bg-available-surface px-4 py-3 text-available">
              <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span>
                <strong>
                  {missingCount}{" "}
                  {missingCount === 1 ? "course is" : "courses are"} not in the
                  catalogue.
                </strong>{" "}
                They are still saved, but may not count toward requirements.
              </span>
            </p>
          )}
          {groups.map(({ term, items }) => (
            <TermGroup
              key={term ? termKey(term) : "before"}
              term={term}
              count={items.length}
            >
              {items.map(({ course, index }) => {
                const { known, missing } = titleOf(course.code);
                return (
                  <CourseRow
                    key={index}
                    code={course.code}
                    title={known?.title ?? course.title}
                    credits={course.credits}
                    grade={course.grade}
                    status={course.status}
                    missing={missing}
                    onRemove={() =>
                      setRemoved((current) => new Set(current).add(index))
                    }
                  />
                );
              })}
            </TermGroup>
          ))}
          {kept.length === 0 && (
            <p className="rounded-md border-2 border-border border-dashed p-6 text-center text-muted-foreground">
              No courses left. You can add them by hand on your profile.
            </p>
          )}
          {transcript.unrecognized.length > 0 && (
            <section>
              <h2 className="text-lg">Lines we could not read</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                Add these courses by hand on your profile if they are missing.
              </p>
              <ul className="mt-3 divide-y divide-border rounded-md border-2 border-border bg-card">
                {transcript.unrecognized.map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed and may repeat
                  <li key={i} className="px-4 py-2.5 text-sm">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-border border-t-2 bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-8 py-4">
          <p className="text-muted-foreground">
            {kept.length} {kept.length === 1 ? "course" : "courses"} ready to
            save
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save}>Save to my profile</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function earliest(transcript: Transcript): Term | null {
  const terms = transcript.courses.flatMap((c) => c.term ?? []);
  return terms.sort(compareTerms)[0] ?? null;
}

/** Credits left come from the transcript's own requirement. Without one, assume a four-year degree. */
function guessGraduationTerm(transcript: Transcript): Term | null {
  const terms = transcript.courses
    .flatMap((c) => c.term ?? [])
    .sort(compareTerms);
  const done = transcript.courses.reduce(
    (sum, c) =>
      COUNTS_TOWARD_CREDITS.includes(c.status) ? sum + (c.credits ?? 0) : sum,
    transcript.advancedStanding,
  );
  return guessGraduation(
    terms[0] ?? null,
    terms.at(-1) ?? null,
    transcript.creditsRequired === null
      ? null
      : transcript.creditsRequired - done,
  );
}
