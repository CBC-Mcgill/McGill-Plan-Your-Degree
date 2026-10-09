import { Notice } from "@/components/ui/notice";
import { Term } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import { GLOSSARY } from "@/lib/glossary";
import type { Program } from "@/lib/programs/types";

/** "Read automatically from the catalogue" for a crawled program or minor (D39). The caller puts a `CatalogueLink` beside it. `hasChecks` adds the rule-to-check sentence only when such a rule exists. */
export function GeneratedNote({ hasChecks }: { hasChecks: boolean }) {
  const { tip, checks } = GLOSSARY.generated;
  return (
    <Term
      def={{ label: COPY.generated, tip: hasChecks ? `${tip} ${checks}` : tip }}
    />
  );
}

/** @deprecated Use `GeneratedNote` beside a `CatalogueLink`. */
export function GeneratedBanner({
  program,
  className,
}: {
  program: Program;
  className?: string;
}) {
  if (!program.generated) return null;
  return (
    <div className={className}>
      <Notice tone="info">
        These requirements were read automatically from the course catalogue.
        Check the rules marked Check this requirement on the{" "}
        <a
          href={program.source}
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          program page
        </a>
        .
      </Notice>
    </div>
  );
}
