import { LiveCourseChip } from "@/components/course-chip";
import { codeRuns } from "@/lib/catalogue/codes";
import { loadCatalogue } from "@/lib/catalogue/server";
import { toStatusInput } from "@/lib/engine/status";
import { logicalCode } from "@/lib/profile/types";

/** The text as written, with every course code that exists in the catalogue as a chip. Server only. */
export async function LinkedCourseText({
  text,
  onlyTaken,
}: {
  text: string;
  onlyTaken?: boolean;
}) {
  const catalogue = await loadCatalogue();
  return codeRuns(text).map(({ at, run, code }) => {
    const course = code ? catalogue.get(logicalCode(run)) : undefined;
    return course ? (
      <LiveCourseChip
        key={at}
        course={toStatusInput(course)}
        label={run}
        onlyTaken={onlyTaken}
      />
    ) : (
      run
    );
  });
}
