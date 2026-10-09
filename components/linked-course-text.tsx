"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { createContext, type ReactNode, use } from "react";
import {
  STATUS,
  type Status,
  StatusIcon,
  StatusTip,
} from "@/components/status";
import { Disclosure } from "@/components/ui/disclosure";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { courseSlug } from "@/lib/catalogue/slug";
import { courseStatus, type StatusInput } from "@/lib/engine/status";
import { GLOSSARY } from "@/lib/glossary";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const TAKEN: ReadonlySet<Status> = new Set([
  "completed",
  "covered",
  "in-progress",
]);

/** True on the page of a course the student has taken or is taking, where glyphs on its requirements only repeat that. */
const Settled = createContext(false);

/** A course code in requirement text: a link with the student's status glyph. With `onlyTaken` it marks only courses already taken, for lists where "can take" would mislead. */
export function LinkedCode({
  course,
  label,
  onlyTaken = false,
}: {
  course: StatusInput;
  label: string;
  onlyTaken?: boolean;
}) {
  const snapshot = useSnapshot();
  const settled = use(Settled);
  const status =
    snapshot && !settled ? courseStatus(course, snapshot).status : null;
  const link = (
    <Link
      href={`/courses/${courseSlug(course.code)}`}
      prefetch={false}
      className="link font-semibold"
    >
      {label}
    </Link>
  );
  if (!status || (onlyTaken && !TAKEN.has(status))) return link;
  return (
    <StatusTip status={status} className="whitespace-nowrap">
      <span className="mr-1 inline-flex align-[-2px]">
        <StatusIcon status={status} label={STATUS[status].label} />
      </span>
      {link}
    </StatusTip>
  );
}

/**
 * Prerequisites, Corequisites or Restrictions as a section, with "Has conditions" beside the heading when the text has a condition we cannot check.
 * Once the student has the course, the glyphs and the flag go, and with `collapse` the section closes behind its heading (pattern B).
 */
export function RequirementSection({
  title,
  course,
  uncertain,
  collapse = false,
  children,
}: {
  title: string;
  course: StatusInput;
  uncertain: boolean;
  collapse?: boolean;
  children: ReactNode;
}) {
  const snapshot = useSnapshot();
  const settled = Boolean(
    snapshot && TAKEN.has(courseStatus(course, snapshot).status),
  );
  const body = (
    <Settled value={settled}>
      <p className="max-w-[68ch]">{children}</p>
    </Settled>
  );
  if (settled && collapse) {
    return (
      <Disclosure as="h2" summary={title}>
        <div className="pt-2">{body}</div>
      </Disclosure>
    );
  }
  return (
    <Section
      title={title}
      meta={
        uncertain &&
        !settled && (
          <span className="inline-flex items-center gap-2 text-warn">
            <CircleAlert aria-hidden className="size-3.5" strokeWidth={2} />
            <Term def={GLOSSARY.hasConditions} />
          </span>
        )
      }
    >
      {body}
    </Section>
  );
}
