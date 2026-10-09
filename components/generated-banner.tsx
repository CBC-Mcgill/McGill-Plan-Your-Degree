import { Term } from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import { GLOSSARY } from "@/lib/glossary";

/** "Read automatically from the catalogue" for a crawled program or minor (D39). The caller puts a `CatalogueLink` beside it. `hasChecks` adds the rule-to-check sentence only when such a rule exists. */
export function GeneratedNote({ hasChecks }: { hasChecks: boolean }) {
  const { tip, checks } = GLOSSARY.generated;
  return (
    <Term
      def={{ label: COPY.generated, tip: hasChecks ? `${tip} ${checks}` : tip }}
    />
  );
}
