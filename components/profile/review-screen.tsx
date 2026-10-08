"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CourseRow, TermGroup } from "@/components/profile/course-row";
import {
  ProgramFields,
  type ProgramValues,
} from "@/components/profile/program-fields";
import { SectionCard } from "@/components/section-card";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCatalogue } from "@/lib/catalogue/client";
import { useProfileStore } from "@/lib/profile/store";
import { groupByTerm, guessGraduation } from "@/lib/profile/terms";
import {
  compareTerms,
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
  const [values, setValues] = useState<ProgramValues>(() => {
    const store = useProfileStore.getState();
    return {
      programId:
        guessProgram(transcript.degree, transcript.programs) ?? store.programId,
      entry: isCegep(transcript.previousEducation) ? "cegep" : store.entry,
      advancedStanding: transcript.advancedStanding,
      creditsRequired: transcript.creditsRequired ?? store.creditsRequired,
      startTerm: earliest(transcript) ?? store.startTerm,
      graduationTerm: store.graduationTerm ?? guessGraduationTerm(transcript),
    };
  });

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
    store.setProgram(values.programId);
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
      <div className="mx-auto w-full max-w-page flex-1 px-8 pt-10 pb-8">
        <h1
          ref={(element) => element?.focus()}
          tabIndex={-1}
          className="focus:outline-none"
        >
          Check your transcript
        </h1>
        <p className="mt-1 max-w-prose text-muted-foreground">
          Nothing is saved until you choose Save to my profile.
        </p>

        <div className="mt-6 flex flex-col gap-6">
          <SectionCard
            id="review"
            title={`${kept.length} ${kept.length === 1 ? "course" : "courses"} across ${termCount} ${termCount === 1 ? "term" : "terms"}`}
            trailing={
              detected.length > 0
                ? `Found: ${detected.join(", ")}`
                : "We could not find a program on this transcript."
            }
          >
            <ProgramFields
              value={values}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            />
            {background && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Found on your transcript: {background}
              </p>
            )}
            {values.programId === null && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Your courses are still saved. Requirements can't be tracked for
                this program yet.
              </p>
            )}
          </SectionCard>

          {missingCount > 0 && (
            <Banner tone="warn" className="px-4 py-3">
              <TriangleAlert aria-hidden className="text-warn" />
              <span>
                <strong>
                  {missingCount}{" "}
                  {missingCount === 1 ? "course is" : "courses are"} not in the
                  catalogue.
                </strong>{" "}
                They are still saved, but may not count toward requirements.
              </span>
            </Banner>
          )}
          <Card className="overflow-hidden">
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
              <p className="px-5 py-8 text-center text-muted-foreground">
                No courses left. You can add them by hand on your profile.
              </p>
            )}
          </Card>
          {transcript.unrecognized.length > 0 && (
            <SectionCard
              id="unread"
              title="Lines we could not read"
              caption="Add these courses by hand on your profile if they are missing."
              bodyClassName=""
            >
              <ul>
                {transcript.unrecognized.map((line, i) => (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: the lines are fixed and may repeat
                    key={i}
                    className="border-border border-t px-5 py-2 text-[13px]"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 border-border border-t bg-card">
        <div className="mx-auto flex max-w-page items-center justify-between gap-6 px-8 py-3">
          <p className="text-muted-foreground">
            {kept.length} {kept.length === 1 ? "course" : "courses"} ready to
            save
          </p>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="lg" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="lg" onClick={save}>
              Save to my profile
            </Button>
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
