import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseStatusPanel } from "@/components/course-status-panel";
import { LinkedCourseText } from "@/components/linked-course-text";
import { getCourse, getUnlocks } from "@/lib/catalogue/server";
import { codeFromSlug, courseSlug } from "@/lib/catalogue/slug";
import type { Course } from "@/lib/catalogue/types";

// Nothing is built ahead, so each course renders on its first visit and is then served from the static cache.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const course = await getCourse(codeFromSlug((await params).slug));
  return {
    title: course ? `${course.code} ${course.title}` : "Course not found",
  };
}

export default async function CoursePage({
  params,
}: PageProps<"/courses/[slug]">) {
  const course = await getCourse(codeFromSlug((await params).slug));
  if (!course) notFound();

  const { description, notes, ...summary } = course;
  const requirements = [
    { title: "Prerequisites", text: course.prerequisites?.text },
    { title: "Corequisites", text: course.corequisites?.text },
    { title: "Restrictions", text: course.restrictions?.text },
  ].filter((item) => item.text);
  // A multi-term course has no page of its own on the catalogue, only its parts do.
  const catalogueSlug = courseSlug(course.parts?.[0]?.code ?? course.code);
  const unlocks = await getUnlocks(course.code);
  const unlockedCourses = (
    await Promise.all(unlocks.map((code) => getCourse(code)))
  ).filter((unlocked): unlocked is Course => unlocked !== undefined);

  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-10">
      <Link
        href="/courses"
        className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-md px-2 font-semibold text-muted-foreground text-sm hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Browse courses
      </Link>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-10">
        <article>
          <h1>
            <span className="block text-primary text-xl">{course.code}</span>{" "}
            <span className="block text-4xl">{course.title}</span>
          </h1>

          <dl className="mt-6 grid grid-cols-3 gap-x-6 gap-y-4 rounded-lg border-2 border-border bg-card p-5">
            <Fact label="Credits" value={creditsText(course.credits)} />
            <Fact label="Offered by" value={course.offeredBy} />
            <Fact label="Faculty" value={course.faculty} />
            <Fact
              className="col-span-3"
              label="Terms offered"
              value={course.terms.join(", ") || "Not offered this year"}
            />
          </dl>

          <p className="mt-8 max-w-prose text-lg leading-relaxed">
            {description || "No description."}
          </p>

          <section id="requirements" className="mt-10 scroll-mt-6">
            <h2 className="text-2xl">Requirements</h2>
            {requirements.length > 0 ? (
              <dl className="mt-4 flex flex-col gap-5">
                {requirements.map(({ title, text }) => (
                  <div key={title}>
                    <dt className="font-bold">{title}</dt>
                    <dd className="mt-1 max-w-prose">
                      <LinkedCourseText text={text ?? ""} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-muted-foreground">
                No prerequisites, corequisites, or restrictions are listed.
              </p>
            )}
          </section>

          {unlocks.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl">Unlocks</h2>
              <p className="mt-3 text-muted-foreground">
                Courses that list {course.code} as a prerequisite.
              </p>
              <UnlockList courses={unlockedCourses.slice(0, 12)} />
              {unlockedCourses.length > 12 && (
                <details className="group mt-1.5">
                  <summary className="inline-flex h-10 cursor-pointer items-center rounded-md font-semibold text-muted-foreground hover:text-foreground group-open:hidden">
                    Show {unlockedCourses.length - 12} more
                  </summary>
                  <UnlockList courses={unlockedCourses.slice(12)} />
                </details>
              )}
            </section>
          )}

          {notes.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl">Notes</h2>
              <ul className="mt-3 flex max-w-prose list-disc flex-col gap-1.5 pl-5">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          <a
            href={`https://coursecatalogue.mcgill.ca/courses/${catalogueSlug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex items-center gap-2 font-semibold underline underline-offset-2 hover:text-primary"
          >
            View on the McGill course catalogue
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </article>

        <aside className="sticky top-6">
          <CourseStatusPanel course={summary} />
        </aside>
      </div>
    </div>
  );
}

function creditsText(credits: number | null) {
  return credits === null ? null : String(credits);
}

function Fact({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-semibold text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value ?? "Not listed"}</dd>
    </div>
  );
}

function UnlockList({ courses }: { courses: Course[] }) {
  return (
    <ul className="mt-3 flex max-w-prose flex-col gap-1.5">
      {courses.map((unlocked) => (
        <li key={unlocked.code}>
          <Link
            href={`/courses/${courseSlug(unlocked.code)}`}
            className="font-semibold text-in-progress underline underline-offset-2 hover:text-foreground"
          >
            {unlocked.code}
          </Link>{" "}
          {unlocked.title}
        </li>
      ))}
    </ul>
  );
}
