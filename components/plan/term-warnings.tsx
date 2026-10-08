import { TriangleAlert } from "lucide-react";
import { Fragment } from "react";
import { CourseLink } from "@/components/course-link";
import type { RequirementTree } from "@/lib/catalogue/types";
import type { PlanWarning } from "@/lib/engine/plan";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { termContext, unmet } from "@/lib/engine/stages";
import type { Plan } from "@/lib/profile/types";

function Need({ tree, nested }: { tree: RequirementTree; nested?: boolean }) {
  if (typeof tree === "string") return <CourseLink code={tree} />;
  const [word, children] =
    "and" in tree ? (["and", tree.and] as const) : (["or", tree.or] as const);
  const parts = children.map((child, i) => (
    <Fragment key={JSON.stringify(child)}>
      {i === 0 ? "" : i === children.length - 1 ? ` ${word} ` : ", "}
      <Need tree={child} nested />
    </Fragment>
  ));
  return nested ? <>({parts})</> : parts;
}

function Others({ codes }: { codes: string[] }) {
  return codes.map((code, i) => (
    <Fragment key={code}>
      {i === 0 ? "" : i === codes.length - 1 ? " or " : ", "}
      <CourseLink code={code} />
    </Fragment>
  ));
}

function Sentence({
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
  if (warning.kind === "credit-limit") {
    return (
      <>
        {warning.credits} credits is over your {warning.limit} credit limit.
      </>
    );
  }
  const course = <CourseLink code={warning.course} />;
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
      {course} needs {need ? <Need tree={need} /> : "its requirements"}{" "}
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
    <section
      aria-labelledby="warnings-heading"
      className="rounded-md border-2 border-primary/30 bg-primary/5 p-4"
    >
      <h3 id="warnings-heading" className="text-base text-primary-edge">
        {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`}
      </h3>
      <p className="text-muted-foreground text-sm">
        These do not block your plan, but check them before you register.
      </p>
      <ul aria-label="Warnings" className="mt-3 flex flex-col gap-2">
        {warnings.map((warning) => (
          <li
            key={`${warning.kind}-${"course" in warning ? warning.course : "term"}`}
            className="flex gap-2.5"
          >
            <TriangleAlert
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-primary-edge"
            />
            <p>
              <Sentence
                warning={warning}
                snapshot={snapshot}
                catalogue={catalogue}
                plan={plan}
              />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
