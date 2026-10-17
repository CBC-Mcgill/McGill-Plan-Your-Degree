"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { ExternalLink } from "@/components/external-link";
import { bugReportUrl } from "@/lib/github";

const LABEL = "Report a bug";

const never = () => () => {};

/** The page with its query string, and the browser. Both are empty on the server. */
function PrefilledLink() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const browser = useSyncExternalStore(
    never,
    () => navigator.userAgent,
    () => "",
  );
  return (
    <ExternalLink
      href={bugReportUrl({
        page: search ? `${pathname}?${search}` : pathname,
        browser,
      })}
    >
      {LABEL}
    </ExternalLink>
  );
}

/** The footer's "Report a bug", GitHub's issue form with the page and browser already filled in. The static HTML carries the plain form link. */
export function ReportBugLink() {
  return (
    <Suspense
      fallback={<ExternalLink href={bugReportUrl({})}>{LABEL}</ExternalLink>}
    >
      <PrefilledLink />
    </Suspense>
  );
}
