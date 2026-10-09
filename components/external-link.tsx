import { ExternalLink as Icon } from "lucide-react";
import type { ReactNode } from "react";
import { COPY } from "@/lib/copy";

/** A link to another site that opens in a new tab and says so. */
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="link">
      {children}
      <Icon aria-hidden className="ml-1 inline size-3.5 align-[-2px]" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** "McGill catalogue", the one wording for every link to McGill's catalogue (D38). */
export function CatalogueLink({ href }: { href: string }) {
  return <ExternalLink href={href}>{COPY.catalogueLink}</ExternalLink>;
}
