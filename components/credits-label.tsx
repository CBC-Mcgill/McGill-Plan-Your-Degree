import { Tooltip } from "@/components/ui/tooltip";
import type { CourseSummary } from "@/lib/catalogue/types";
import { creditsLabel } from "@/lib/engine/parts";
import { GLOSSARY } from "@/lib/glossary";

/** "3 cr", or "6 cr, 2 terms" with the term count explained on hover. `bare` drops the "cr" for a column already headed Credits. Not focusable, so it can sit inside a course link. */
export function CreditsLabel({
  course,
  bare = false,
}: {
  course: Pick<CourseSummary, "credits" | "parts">;
  bare?: boolean;
}) {
  const label = creditsLabel(course);
  const [credits = label, terms] = (
    bare ? label.replace(" cr", "") : label
  ).split(", ");
  if (!terms) return credits;
  return (
    <>
      {credits}
      {bare ? " · " : ", "}
      <Tooltip content={GLOSSARY.multiTerm.tip}>
        <span className="underline decoration-dotted decoration-fg-subtle underline-offset-3">
          {terms}
        </span>
      </Tooltip>
    </>
  );
}
