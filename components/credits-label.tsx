import { Tooltip } from "@/components/ui/tooltip";
import type { CourseSummary } from "@/lib/catalogue/types";
import { creditsLabel } from "@/lib/engine/parts";
import { GLOSSARY } from "@/lib/glossary";

/** "3 cr", or "6 cr, 2 terms" with the term count explained on hover. */
export function CreditsLabel({
  course,
}: {
  course: Pick<CourseSummary, "credits" | "parts">;
}) {
  const [credits, terms] = creditsLabel(course).split(", ");
  if (!terms) return credits;
  return (
    <>
      {credits},{" "}
      <Tooltip content={GLOSSARY.multiTerm.tip}>
        <span className="underline decoration-dotted underline-offset-2">
          {terms}
        </span>
      </Tooltip>
    </>
  );
}
