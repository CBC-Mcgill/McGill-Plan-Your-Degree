import { Fragment } from "react";
import { CourseLink } from "@/components/course-link";
import { RequirementText } from "@/components/requirement-text";
import { Notice } from "@/components/ui/notice";
import type { PlanWarning } from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { termContext, unmet } from "@/lib/engine/stages";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import { currentTerm } from "@/lib/profile/terms";
import { compareTerms, type Plan } from "@/lib/profile/types";

function Others({ codes }: { codes: string[] }) {
  return codes.map((code, i) => (
    <Fragment key={code}>
      {i === 0 ? "" : i === codes.length - 1 ? " or " : ", "}
      <CourseLink code={code} />
    </Fragment>
  ));
}

export function Sentence({
  warning,
  snapshot,
  catalogue,
  plan,
}: {
  warning: PlanWarning;
  snapshot: Snapshot;
  catalogue: Catalogue;
  plan: Plan;
}) {
  const graduation = useProfileStore((state) => state.graduationTerm);
  if (warning.kind === "credit-limit") {
    return (
      <>
        {warning.credits} credits is over your {warning.limit} credit limit.
      </>
    );
  }
  const course = <CourseLink code={warning.course} />;
  if (warning.kind === "missing-part") {
    const part = (suffix: string) => (
      <CourseLink code={warning.course} label={warning.course + suffix} />
    );
    return compareTerms(warning.term, currentTerm()) < 0 ? (
      <>
        {part(warning.part)} was due in {termLabel(warning.term)}. Neither part
        counts until it is done.
      </>
    ) : (
      <>
        {part(warning.part)} must follow {part(warning.after)} in{" "}
        {termLabel(warning.term)} or neither counts.
      </>
    );
  }
  if (warning.kind === "after-graduation") {
    const starts = graduation && compareTerms(warning.term, graduation) > 0;
    return (
      <>
        {course}{" "}
        {starts
          ? `is planned for ${termLabel(warning.term)}`
          : `continues into ${termLabel(warning.ends)}`}
        , after your expected graduation
        {graduation && ` in ${termLabel(graduation)}`}.
      </>
    );
  }
  if (warning.kind === "not-offered") {
    return (
      <>
        {course} is not offered in {warning.term.season}.
      </>
    );
  }
  if (warning.kind === "restriction") {
    return (
      <>
        {course} can't be taken with <Others codes={warning.blockedBy} />.
      </>
    );
  }
  const requirement = catalogue.get(warning.course)?.[
    warning.kind === "prerequisite" ? "prerequisites" : "corequisites"
  ];
  const { before, alongside } = termContext(snapshot, plan, warning.term);
  const need = unmet(
    requirement?.tree,
    warning.kind === "prerequisite" ? before : alongside,
  );
  return (
    <>
      {course} needs{" "}
      {need ? (
        <RequirementText
          tree={need}
          leaf={(code) => <CourseLink code={code} />}
        />
      ) : (
        "its requirements"
      )}{" "}
      {warning.kind === "prerequisite"
        ? "in an earlier term."
        : "in the same term or earlier."}
      {warning.uncertain && " Check the course page for other conditions."}
    </>
  );
}

/** The term's warnings in plain language, one per line. Warnings never block the plan. */
export function TermWarnings({
  warnings,
  snapshot,
  catalogue,
  plan,
}: {
  warnings: PlanWarning[];
  snapshot: Snapshot;
  catalogue: Catalogue;
  plan: Plan;
}) {
  if (warnings.length === 0) return null;
  return (
    <ul aria-label="Warnings" className="flex flex-col gap-2">
      {warnings.map((warning) => (
        <li
          key={`${warning.kind}-${"course" in warning ? warning.course : "term"}`}
        >
          <Notice tone="warn">
            <Sentence
              warning={warning}
              snapshot={snapshot}
              catalogue={catalogue}
              plan={plan}
            />
          </Notice>
        </li>
      ))}
    </ul>
  );
}
