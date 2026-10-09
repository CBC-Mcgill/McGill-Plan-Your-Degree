"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { createContext, type ReactNode, use } from "react";
import {
  STATUS,
  type Status,
  StatusBadge,
  StatusIcon,
  StatusTip,
} from "@/components/status";
import { Disclosure } from "@/components/ui/disclosure";
import { Section } from "@/components/ui/section";
import { Term } from "@/components/ui/tooltip";
import { CodeRow } from "@/components/unlock-rows";
import { courseSlug } from "@/lib/catalogue/slug";
import type { RequirementTree } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import type { Snapshot } from "@/lib/engine/snapshot";
import {
  courseStatus,
  meets,
  missingText,
  requirementItems,
  type StatusInput,
} from "@/lib/engine/status";
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
 * Prerequisites, Corequisites or Restrictions as a section, with "Has conditions" beside the heading when the text has a condition we cannot check, or with `tree` how many of its parts the student has.
 * Once the student has the course, the statuses and the flag go, and with `collapse` the section closes behind its heading (pattern B).
 */
export function RequirementSection({
  title,
  course,
  uncertain,
  tree,
  collapse = false,
  children,
}: {
  title: string;
  course: StatusInput;
  uncertain: boolean;
  tree?: RequirementTree;
  collapse?: boolean;
  children: ReactNode;
}) {
  const snapshot = useSnapshot();
  const settled = Boolean(
    snapshot && TAKEN.has(courseStatus(course, snapshot).status),
  );
  const body = <Settled value={settled}>{children}</Settled>;
  const items = tree && requirementItems(tree);
  if (settled && collapse) {
    return (
      <Disclosure as="h2" summary={title}>
        {body}
      </Disclosure>
    );
  }
  return (
    <Section
      title={title}
      meta={
        settled ? null : uncertain ? (
          <span className="inline-flex items-center gap-2 text-warn">
            <CircleAlert aria-hidden className="size-3.5" strokeWidth={2} />
            <Term def={GLOSSARY.hasConditions} />
          </span>
        ) : (
          items &&
          snapshot &&
          `${items.filter((item) => meets(item, snapshot.taken)).length} of ${items.length} met`
        )
      }
    >
      {body}
    </Section>
  );
}

/** What the checklist shows for each code in a requirement, keyed by the code as written. A code missing here is not in the catalogue. */
export type RequirementCourses = Record<
  string,
  StatusInput & { title: string }
>;

/**
 * A parsed requirement as a checklist: one row per course with the student's status, and each "or" as a One of group that says whether it is met.
 * An "and" inside an "or" is an All of group, indented one level more.
 */
export function RequirementChecklist({
  tree,
  courses,
}: {
  tree: RequirementTree;
  courses: RequirementCourses;
}) {
  const snapshot = useSnapshot();
  const settled = use(Settled);
  const known = snapshot && !settled ? snapshot : null;

  const row = (code: string) => {
    const course = courses[code];
    const status = course && known && courseStatus(course, known).status;
    return (
      <CodeRow
        key={code}
        code={code}
        title={course?.title ?? ""}
        page={course?.code}
        note={
          !course
            ? "Not in this year's catalogue"
            : status === "locked" && known
              ? lockedNote(course, known)
              : undefined
        }
        end={status && <StatusBadge status={status} />}
      />
    );
  };

  const node = (tree: RequirementTree, parent: "and" | "or"): ReactNode => {
    if (typeof tree === "string") return row(tree);
    const [kind, children] =
      "and" in tree ? (["and", tree.and] as const) : (["or", tree.or] as const);
    const items = children.map((child) => node(child, kind));
    if (kind === parent) return items;
    return (
      <li
        key={JSON.stringify(tree)}
        className="-mx-5 border-line border-t px-5 pb-2 first:border-t-0"
      >
        <div className="flex h-11 items-center justify-between gap-4">
          <span className="font-semibold">
            {kind === "or" ? "One of" : "All of"}
          </span>
          {known && <GroupStatus tree={tree} snapshot={known} />}
        </div>
        <ul className="ml-1.5 border-line border-l-2 pl-5">{items}</ul>
      </li>
    );
  };

  return <ul className="-my-4">{node(tree, "and")}</ul>;
}

/** Why a course in a requirement is locked: a restriction, or what it still needs. */
function lockedNote(course: StatusInput, snapshot: Snapshot) {
  const { blockedBy } = courseStatus(course, snapshot);
  if (blockedBy.length > 0) return COPY.notOpen(blockedBy);
  const tree = course.prerequisites?.tree;
  return tree ? COPY.needs(missingText(tree, snapshot.taken)) : undefined;
}

/** "Met by COMP 302" in the color of how it is met, or "Not yet". */
function GroupStatus({
  tree,
  snapshot,
}: {
  tree: Exclude<RequirementTree, string>;
  snapshot: Snapshot;
}) {
  const met =
    "or" in tree
      ? tree.or.find((child) => meets(child, snapshot.taken))
      : meets(tree, snapshot.taken)
        ? tree
        : undefined;
  if (met === undefined) return <span className="text-fg-muted">Not yet</span>;
  const status: Status = meets(met, snapshot.done)
    ? "completed"
    : "in-progress";
  return (
    <span
      className="flex items-center gap-2"
      style={{ color: STATUS[status].text }}
    >
      <StatusIcon status={status} />
      {typeof met === "string" ? `Met by ${met}` : "Met"}
    </span>
  );
}
