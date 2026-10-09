import { Info } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import type { Program } from "@/lib/programs/types";

export const externalLink =
  "font-medium underline underline-offset-2 hover:text-primary";

/** Says that the crawler wrote a program's requirements and where to check them. A hand-written program shows nothing. */
export function GeneratedBanner({
  program,
  className,
}: {
  program: Program;
  className?: string;
}) {
  if (!program.generated) return null;
  return (
    <Banner className={className}>
      <Info aria-hidden />
      <span>
        These requirements were read automatically from the course catalogue.
        Check the rules marked Check this requirement on the{" "}
        <a
          href={program.source}
          target="_blank"
          rel="noopener noreferrer"
          className={externalLink}
        >
          program page
        </a>
        .
      </span>
    </Banner>
  );
}
