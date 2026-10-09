import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToPlan, CourseFacts } from "@/components/add-to-plan";
import {
  LinkedCode,
  RequirementSection,
} from "@/components/linked-course-text";
import { RequirementText } from "@/components/requirement-text";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { UnlockRows } from "@/components/unlock-rows";
import { codeRuns } from "@/lib/catalogue/codes";
import { getUnlocks, loadCatalogue } from "@/lib/catalogue/server";
import { codeFromSlug, courseSlug } from "@/lib/catalogue/slug";
import type { Course, CourseSummary } from "@/lib/catalogue/types";
import { facultyName } from "@/lib/engine/browse";
import { toStatusInput } from "@/lib/engine/status";
import { logicalCode } from "@/lib/profile/types";

/** Catalogue notes the page already says another way: hours ("3 hours", "(3-4-5)"), the seasons, and on a multi-term course the rules its routes line covers. */
const HOURS =
  /^\(?\d[\d.]*-\d[\d.]*-\d[\d.]*\)?$|^\d[\d.]* (hours?|lectures?)\b/i;
const SEASONS = /^(Fall|Winter|Summer)((,| or| and) (Fall|Winter|Summer))*$/;
const PARTS =
  /^(Students must (also )?register for|No credit will be given for this course unless both)/;

const summaryOf = ({
  description: _description,
  notes: _notes,
  ...summary
}: Course): CourseSummary => summary;

// Nothing is built ahead, so each course renders on its first visit and is then served from the static cache.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = (await loadCatalogue()).get(codeFromSlug((await params).slug));
  return {
    title: course ? `${course.code} ${course.title}` : "Course not found",
  };
}

export default async function CoursePage({
  params,
}: PageProps<"/courses/[slug]">) {
  const catalogue = await loadCatalogue();
  const course = catalogue.get(codeFromSlug((await params).slug));
  if (!course) notFound();

  const summary = summaryOf(course);
  const owner = toStatusInput(course);
  const notes = course.notes.filter(
    (note) =>
      !HOURS.test(note) &&
      !SEASONS.test(note) &&
      !(course.parts && PARTS.test(note)),
  );
  const unlocks = (await getUnlocks(course.code)).flatMap((code) => {
    const unlocked = catalogue.get(code);
    return unlocked ? [summaryOf(unlocked)] : [];
  });
  // A multi-term course has no page of its own on the catalogue, only its parts do.
  const catalogueSlug = courseSlug(course.parts?.[0]?.code ?? course.code);
  const offeredBy = [course.offeredBy, facultyName(course.faculty)]
    .filter(Boolean)
    .join(" · ");

  /** The text as written, with every code the catalogue knows as a link. */
  const linked = (text: string, onlyTaken = false) =>
    codeRuns(text).map(({ at, run, code }) => {
      const found = code ? catalogue.get(logicalCode(run)) : undefined;
      return found ? (
        <LinkedCode
          key={at}
          course={toStatusInput(found)}
          label={run}
          onlyTaken={onlyTaken}
        />
      ) : (
        run
      );
    });

  const requirements = [
    { title: "Prerequisites", item: course.prerequisites },
    { title: "Corequisites", item: course.corequisites },
    { title: "Restrictions", item: course.restrictions },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-8 pt-12">
      <p className="font-semibold text-fg-muted">{course.code}</p>
      <div className="mt-2 flex items-start justify-between gap-8">
        <h1 className="min-w-0 max-w-reading">{course.title}</h1>
        <div className="mt-1 shrink-0">
          <AddToPlan course={summary} />
        </div>
      </div>

      <div className="max-w-reading">
        <CourseFacts
          course={summary}
          catalogueUrl={`https://coursecatalogue.mcgill.ca/courses/${catalogueSlug}/`}
          noPrerequisites={!course.prerequisites?.text}
        />

        {(course.description || notes.length > 0) && (
          <div className="mt-12 flex max-w-[68ch] flex-col gap-2">
            {course.description && <p>{course.description}</p>}
            {notes.map((note) => (
              <p key={note} className="text-fg-muted">
                {note}
              </p>
            ))}
          </div>
        )}

        <div className="mt-12 space-y-12">
          {requirements.map(({ title, item }) => {
            if (!item?.text) return null;
            const tree = "tree" in item ? item.tree : null;
            const unparsed = "unparsed" in item && item.unparsed;
            return (
              <RequirementSection
                key={title}
                title={title}
                course={owner}
                uncertain={unparsed}
                collapse={title === "Prerequisites"}
              >
                {tree && !unparsed ? (
                  <RequirementText tree={tree} leaf={(code) => linked(code)} />
                ) : (
                  linked(item.text, title === "Restrictions")
                )}
              </RequirementSection>
            );
          })}

          {unlocks.length > 0 && (
            <Section
              title={
                <Term
                  def={{
                    label: "Unlocks",
                    tip: `Courses that list ${course.code} as a prerequisite.`,
                  }}
                />
              }
            >
              <UnlockRows courses={unlocks} />
            </Section>
          )}

          {offeredBy && <p className="text-fg-muted">{offeredBy}</p>}
        </div>
      </div>
    </div>
  );
}
