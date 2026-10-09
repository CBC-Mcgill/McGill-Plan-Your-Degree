import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToPlan } from "@/components/add-to-plan";
import { CourseRatings } from "@/components/course-ratings";
import { CourseStatusPanel } from "@/components/course-status-panel";
import { LinkedCourseText } from "@/components/linked-course-text";
import { RequirementText } from "@/components/requirement-text";
import { SectionCard } from "@/components/section-card";
import { UncertainFlag } from "@/components/status";
import { UnlockRows } from "@/components/unlock-rows";
import meta from "@/data/catalogue/meta.json";
import { getUnlocks, leaves, loadCatalogue } from "@/lib/catalogue/server";
import { codeFromSlug, courseSlug } from "@/lib/catalogue/slug";
import { creditsLabel, routesText } from "@/lib/engine/parts";
import { toStatusInput } from "@/lib/engine/status";
import { logicalCode } from "@/lib/profile/types";

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

  const { description, notes, ...summary } = course;
  const requirements = [
    { title: "Prerequisites", item: course.prerequisites },
    { title: "Corequisites", item: course.corequisites },
    { title: "Restrictions", item: course.restrictions },
  ].flatMap(({ title, item }) =>
    item?.text
      ? [
          {
            title,
            text: item.text,
            tree: "tree" in item ? item.tree : null,
            unparsed: "unparsed" in item && item.unparsed,
          },
        ]
      : [],
  );
  // A multi-term course has no page of its own on the catalogue, only its parts do.
  const catalogueSlug = courseSlug(course.parts?.[0]?.code ?? course.code);
  const unlocks = (await getUnlocks(course.code)).flatMap((code) => {
    const unlocked = catalogue.get(code);
    return unlocked
      ? [
          {
            course: toStatusInput(unlocked),
            title: unlocked.title,
            credits: creditsLabel(unlocked),
          },
        ]
      : [];
  });
  const routes = routesText(course);
  const tree = course.prerequisites?.tree;
  const prerequisites = Object.fromEntries(
    (tree ? leaves(tree) : []).flatMap((leaf) => {
      const required = catalogue.get(logicalCode(leaf));
      return required ? [[required.code, toStatusInput(required)]] : [];
    }),
  );

  return (
    <div className="mx-auto w-full max-w-page px-8 py-8">
      <Link
        href="/courses"
        className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-medium text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Browse courses
      </Link>

      <div className="mt-3 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1>
            <span className="block font-medium font-sans text-[13px] text-muted-foreground leading-[18px] tracking-normal font-stretch-normal">
              {course.code}
            </span>{" "}
            <span className="mt-1 block">{course.title}</span>
          </h1>
          {routes && (
            <p className="mt-2 max-w-prose text-muted-foreground">{routes}</p>
          )}
        </div>
        <AddToPlan course={summary} year={meta.catalogueYear} />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-6">
        <div className="flex flex-col gap-6">
          <SectionCard id="about" title="About">
            <p className="leading-6">{description || "No description."}</p>
            {notes.length > 0 && (
              <ul className="mt-4 flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard id="requirements" title="Requirements">
            {requirements.length > 0 ? (
              <dl className="divide-y divide-border">
                {requirements.map(({ title, text, tree, unparsed }) => (
                  <div key={title} className="py-3 first:pt-0 last:pb-0">
                    <dt className="flex items-center gap-3 font-medium text-[13px] text-muted-foreground">
                      {title}
                      {unparsed && <UncertainFlag withLabel />}
                    </dt>
                    <dd className="mt-1 leading-7">
                      {tree && !unparsed ? (
                        <RequirementText
                          tree={tree}
                          leaf={(code) => <LinkedCourseText text={code} />}
                        />
                      ) : (
                        <LinkedCourseText
                          text={text}
                          onlyTaken={title === "Restrictions"}
                        />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">
                No prerequisites, corequisites, or restrictions are listed.
              </p>
            )}
          </SectionCard>

          {unlocks.length > 0 && (
            <SectionCard
              id="unlocks"
              title="Unlocks"
              caption={`Courses that list ${course.code} as a prerequisite.`}
              bodyClassName=""
            >
              <UnlockRows courses={unlocks} />
            </SectionCard>
          )}
        </div>

        <aside aria-label="About this course" className="flex flex-col gap-6">
          <CourseStatusPanel course={summary} prerequisites={prerequisites} />

          <SectionCard id="details" title="Details" bodyClassName="">
            <dl className="divide-y divide-border border-border border-t text-[13px]">
              <Fact label="Credits" value={creditsText(course.credits)} />
              <Fact
                label="Terms offered"
                value={course.terms.join(", ") || "Not offered this year"}
              />
              <Fact label="Offered by" value={course.offeredBy} />
              <Fact label="Faculty" value={course.faculty} />
            </dl>
            <a
              href={`https://coursecatalogue.mcgill.ca/courses/${catalogueSlug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-between gap-2 border-border border-t px-5 font-medium text-[13px] hover:bg-subtle"
            >
              View on the McGill course catalogue
              <ExternalLink aria-hidden className="size-3.5 shrink-0" />
            </a>
          </SectionCard>

          <CourseRatings code={course.parts?.[0]?.code ?? course.code} />
        </aside>
      </div>
    </div>
  );
}

function creditsText(credits: number | null) {
  return credits === null ? null : String(credits);
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value ?? "Not listed"}</dd>
    </div>
  );
}
