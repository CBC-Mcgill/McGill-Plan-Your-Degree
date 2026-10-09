import { TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { CourseLink } from "@/components/course-link";
import { RequirementText } from "@/components/requirement-text";
import { Banner } from "@/components/ui/banner";
import { InfoTip } from "@/components/ui/tooltip";
import type { PlanWarning } from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { termContext, unmet } from "@/lib/engine/stages";
import { GLOSSARY } from "@/lib/glossary";
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

/** The term's warnings in plain language. Warnings never block the plan. */
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
    <Banner
      tone="warn"
      role="group"
      aria-labelledby="warnings-heading"
      className="block text-warn"
    >
      <div className="flex items-center gap-1.5 text-[13px] leading-[18px]">
        <h3 id="warnings-heading" className="flex items-center gap-1.5">
          <TriangleAlert aria-hidden className="mt-0" strokeWidth={2} />
          {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`}
        </h3>
        <InfoTip {...GLOSSARY.warnings} />
      </div>
      <ul aria-label="Warnings" className="mt-1.5 flex flex-col gap-1">
        {warnings.map((warning) => (
          <li
            key={`${warning.kind}-${"course" in warning ? warning.course : "term"}`}
            className="text-[13px] leading-[18px]"
          >
            <Sentence
              warning={warning}
              snapshot={snapshot}
              catalogue={catalogue}
              plan={plan}
            />
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs leading-4 opacity-80">
        These do not block your plan, but check them before you register.
      </p>
    </Banner>
  );
}
