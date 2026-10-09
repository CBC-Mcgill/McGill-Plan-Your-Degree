"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseRow, TermGroup } from "@/components/profile/course-row";
import {
  ProgramFields,
  type ProgramValues,
} from "@/components/profile/program-fields";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { useCatalogue } from "@/lib/catalogue/client";
import { COPY } from "@/lib/copy";
import { creditNote } from "@/lib/engine/parts";
import { buildSnapshot } from "@/lib/engine/snapshot";
import { recordFromLine, useProfileStore } from "@/lib/profile/store";
import { defaultGraduation } from "@/lib/profile/term-options";
import { groupByTerm, lastTerm } from "@/lib/profile/terms";
import {
  compareTerms,
  isCegep,
  logicalCode,
  type Term,
  termKey,
} from "@/lib/profile/types";
import { guessMinor, guessProgram } from "@/lib/programs";
import { useProgramIndex } from "@/lib/programs/client";
import type { ProgramSummary } from "@/lib/programs/types";
import type { Transcript } from "@/lib/transcript/parse";

type ReviewProps = { transcript: Transcript; onCancel: () => void };

const bone = "rounded-md bg-tint motion-safe:animate-pulse";
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Waits for the program list, so the guess can search all programs. A list that fails to load leaves only the five exact guesses. */
export function ReviewScreen(props: ReviewProps) {
  const index = useProgramIndex();
  if (index.status === "loading") return <ReviewSkeleton />;
  return (
    <Review
      {...props}
      programs={index.status === "ready" ? index.programs : []}
    />
  );
}

function ReviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-page px-8 pt-12">
      <p role="status" className="sr-only">
        Reading your transcript
      </p>
      <div aria-hidden className="max-w-reading">
        <div className={`${bone} h-11 w-96`} />
        <div className={`${bone} mt-8 h-9`} />
        <div className={`${bone} mt-4 h-9`} />
        <div className={`${bone} mt-12 h-7 w-28`} />
        {Array.from({ length: 5 }, (_, row) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
          <div key={row} className={`${bone} mt-4 h-7`} />
        ))}
      </div>
    </div>
  );
}

function Review({
  transcript,
  onCancel,
  programs,
}: ReviewProps & { programs: ProgramSummary[] }) {
  const router = useRouter();
  const catalogue = useCatalogue();
  // Saving keeps manual records and replaces transcript ones, so a re-import says so.
  const [reimport] = useState(() =>
    useProfileStore.getState().records.some((r) => r.source === "transcript"),
  );
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [values, setValues] = useState<ProgramValues>(() => {
    const store = useProfileStore.getState();
    const entry = isCegep(transcript.previousEducation) ? "cegep" : store.entry;
    const start = earliest(transcript);
    return {
      programId:
        guessProgram(transcript.degree, transcript.programs, programs) ??
        store.programId,
      minorId:
        guessMinor(transcript.degree, transcript.minors, programs) ??
        store.minorId,
      entry,
      advancedStanding: transcript.advancedStanding,
      creditsRequired: transcript.creditsRequired ?? store.creditsRequired,
      startTerm: start ?? store.startTerm,
      graduationTerm:
        store.graduationTerm ??
        (start &&
          defaultGraduation(start, entry, lastTerm(transcript.courses))),
    };
  });

  const kept = transcript.courses.flatMap((course, index) =>
    removed.has(index) ? [] : [{ course, index, term: course.term }],
  );
  const groups = groupByTerm(kept);
  const pending = buildSnapshot(
    kept.map(({ course }) => recordFromLine(course)),
  ).pending;
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
  ]
    .filter(Boolean)
    .join(", ");
  const unread = transcript.unrecognized;

  function save() {
    const store = useProfileStore.getState();
    store.applyTranscript({
      ...transcript,
      courses: kept.map(({ course }) => course),
    });
    store.setProgram(values.programId);
    store.setMinor(values.minorId);
    store.setBackground({
      entry: values.entry,
      advancedStanding: values.advancedStanding,
      creditsRequired: values.creditsRequired,
    });
    store.setTerms({
      startTerm: values.startTerm,
      graduationTerm: values.graduationTerm,
    });
    router.push("/next");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-page flex-1 px-8 pt-12 pb-12">
        <div className="max-w-reading">
          <h1
            ref={(element) => element?.focus()}
            tabIndex={-1}
            className="focus:outline-none"
          >
            Check your transcript
          </h1>

          {(unread.length > 0 || missingCount > 0 || !detected) && (
            <div className="mt-6 flex flex-col gap-4">
              {unread.length > 0 && (
                <div>
                  <Notice tone="warn">
                    {plural(unread.length, "line", "lines")} could not be read.
                    Add them by hand on your profile if they are missing.
                  </Notice>
                  <ul className="mt-2 pl-6 text-fg-muted">
                    {unread.map((line, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed and may repeat
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {missingCount > 0 && (
                <Notice tone="warn">
                  {missingCount === 1
                    ? "1 course is not in the catalogue. It is still saved, but may not count toward requirements."
                    : `${missingCount} courses are not in the catalogue. They are still saved, but may not count toward requirements.`}
                </Notice>
              )}
              {!detected && (
                <Notice tone="info">
                  We could not find a program on this transcript.
                </Notice>
              )}
            </div>
          )}

          <div className="mt-8">
            <ProgramFields
              value={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              detected={detected || undefined}
            />
            {values.programId === null && detected && (
              <p className="mt-4 text-fg-muted">
                Your courses are still saved. Requirements can't be tracked for
                this program yet.
              </p>
            )}
          </div>

          <div className="mt-12">
            <Section title="Courses">
              {kept.length === 0 ? (
                <p className="text-fg-muted">
                  No courses left. You can add them by hand on your profile.
                </p>
              ) : (
                <div>
                  {groups.map(({ term, items }) => (
                    <TermGroup
                      key={term ? termKey(term) : "before"}
                      term={term}
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
                            note={creditNote(recordFromLine(course), pending)}
                            missing={missing}
                            onRemove={() => {
                              setRemoved((current) =>
                                new Set(current).add(index),
                              );
                              toast(`${course.code} removed`, {
                                label: COPY.undo,
                                run: () =>
                                  setRemoved((current) => {
                                    const next = new Set(current);
                                    next.delete(index);
                                    return next;
                                  }),
                              });
                            }}
                          />
                        );
                      })}
                    </TermGroup>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-bg shadow-float">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-8">
          <p className="text-fg-muted">
            {plural(kept.length, "course", "courses")}, not saved yet.
            {reimport &&
              " Saving replaces your imported courses and keeps the ones you added by hand."}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="text" onClick={onCancel}>
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
