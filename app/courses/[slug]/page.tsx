import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToPlan, CourseStatusLine } from "@/components/add-to-plan";
import { CourseCode } from "@/components/course-code";
import { CourseFactsBar } from "@/components/course-facts";
import { CatalogueLink } from "@/components/external-link";
import {
  LinkedCode,
  RequirementChecklist,
  type RequirementCourses,
  RequirementSection,
} from "@/components/linked-course-text";
import { RequirementText } from "@/components/requirement-text";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { UnlockRows } from "@/components/unlock-rows";
import { codeRuns } from "@/lib/catalogue/codes";
import { getUnlocks, loadCatalogue } from "@/lib/catalogue/server";
import { codeFromSlug, courseSlug } from "@/lib/catalogue/slug";
import type {
  Course,
  CourseSummary,
  RequirementTree,
} from "@/lib/catalogue/types";
import { facultyName } from "@/lib/engine/browse";
import { routesText } from "@/lib/engine/parts";
import { leaves, toStatusInput } from "@/lib/engine/status";
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

  /** Title and status fields for each code in a tree, as the checklist needs them. */
  const treeCourses = (tree: RequirementTree): RequirementCourses =>
    Object.fromEntries(
      leaves(tree).flatMap((code) => {
        const found = catalogue.get(logicalCode(code));
        return found
          ? [[code, { ...toStatusInput(found), title: found.title }]]
          : [];
      }),
    );

  const requirements = [
    { title: "Prerequisites", item: course.prerequisites },
    { title: "Corequisites", item: course.corequisites },
    { title: "Restrictions", item: course.restrictions },
  ];
  const routes = routesText(course);

  return (
    <div className="mx-auto w-full max-w-page px-8 py-12">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="font-semibold">
            <CourseCode code={course.code} />
          </p>
          <h1 className="mt-2 max-w-reading">{course.title}</h1>
          <CourseStatusLine course={summary} />
        </div>
        <div className="mt-8 shrink-0">
          <AddToPlan course={summary} />
        </div>
      </div>

      <CourseFactsBar course={summary} />

      <div className="mt-6 grid grid-cols-12 items-start gap-6">
        <div className="col-span-7 flex flex-col gap-6">
          <Section title="About">
            <div className="flex max-w-[68ch] flex-col gap-2">
              {course.description && <p>{course.description}</p>}
              {[routes, ...notes].map(
                (note) =>
                  note && (
                    <p key={note} className="text-fg-muted">
                      {note}
                    </p>
                  ),
              )}
              <p className="mt-2 text-fg-muted">
                {offeredBy && `${offeredBy} · `}
                <CatalogueLink
                  href={`https://coursecatalogue.mcgill.ca/courses/${catalogueSlug}/`}
                />
              </p>
            </div>
          </Section>

          {!course.prerequisites?.text && (
            <Section title="Prerequisites">
              <p className="text-fg-muted">None</p>
            </Section>
          )}

          {requirements.map(({ title, item }) => {
            if (!item?.text) return null;
            const tree = "tree" in item && !item.unparsed ? item.tree : null;
            const checklist = title === "Prerequisites" && tree;
            return (
              <RequirementSection
                key={title}
                title={title}
                course={owner}
                uncertain={"unparsed" in item && item.unparsed}
                tree={checklist || undefined}
                collapse={title === "Prerequisites"}
              >
                {checklist ? (
                  <RequirementChecklist
                    tree={checklist}
                    courses={treeCourses(checklist)}
                  />
                ) : (
                  <p className="max-w-[68ch]">
                    {tree ? (
                      <RequirementText
                        tree={tree}
                        leaf={(code) => linked(code)}
                      />
                    ) : (
                      linked(item.text, title === "Restrictions")
                    )}
                  </p>
                )}
              </RequirementSection>
            );
          })}
        </div>

        <Section
          className="col-span-5"
          title={
            <Term
              def={{
                label: "Unlocks",
                tip: `Courses that list ${course.code} as a prerequisite.`,
              }}
            />
          }
          meta={
            unlocks.length > 0 &&
            `${unlocks.length} ${unlocks.length === 1 ? "course" : "courses"}`
          }
        >
          {unlocks.length > 0 ? (
            <UnlockRows courses={unlocks} />
          ) : (
            <p className="text-fg-muted">
              No course lists {course.code} as a prerequisite.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
