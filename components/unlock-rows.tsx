"use client";

import { CourseRow } from "@/components/course-row";
import { ShowMore } from "@/components/ui/disclosure";
import type { CourseSummary } from "@/lib/catalogue/types";
import { courseStatus } from "@/lib/engine/status";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SHOWN = 12;

/** The courses a course unlocks, with the student's status glyph on each. Past 12 the rest open behind "Show N more", unless only 3 or fewer are left. */
export function UnlockRows({ courses }: { courses: CourseSummary[] }) {
  const split = courses.length > SHOWN + 3 ? SHOWN : courses.length;
  const rest = courses.slice(split);
  return (
    <>
      <Rows courses={courses.slice(0, split)} />
      {rest.length > 0 && (
        <ShowMore count={rest.length}>
          <Rows courses={rest} />
        </ShowMore>
      )}
    </>
  );
}

function Rows({ courses }: { courses: CourseSummary[] }) {
  const snapshot = useSnapshot();
  return (
    <ul>
      {courses.map((course) => {
        const state = snapshot ? courseStatus(course, snapshot) : null;
        return (
          <CourseRow
            key={course.code}
            course={course}
            status={state?.status}
            showGlyph={state !== null}
            uncertain={state?.uncertain}
          />
        );
      })}
    </ul>
  );
}
