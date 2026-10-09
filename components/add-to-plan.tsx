"use client";

import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { flushSync } from "react-dom";
import { CourseRatings } from "@/components/course-ratings";
import { CatalogueLink } from "@/components/external-link";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import {
  STATUS,
  type Status,
  StatusIcon,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Term } from "@/components/ui/tooltip";
import { useCatalogue } from "@/lib/catalogue/client";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { list, partRoutes, routesText } from "@/lib/engine/parts";
import {
  courseLoads,
  loadsTerms,
  type TermChoice,
  termChoices,
} from "@/lib/engine/plan";
import type { Snapshot } from "@/lib/engine/snapshot";
import {
  courseStatus,
  isOffered,
  meets,
  missingText,
} from "@/lib/engine/status";
import { GLOSSARY, STATUS_TIPS } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import { planTermOptions } from "@/lib/profile/term-options";
import { currentTerm } from "@/lib/profile/terms";
import {
  type CourseRecord,
  type Term as PlanTerm,
  termKey,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";

const SEASONS = ["Fall", "Winter", "Summer"] as const;
const runsThisYear = (course: CourseSummary) =>
  SEASONS.some((season) => isOffered(course, season));

/** The status line and the facts line under the course title. The status line is for students only, and states the status once (D33). */
export function CourseFacts({
  course,
  catalogueUrl,
  noPrerequisites,
}: {
  course: CourseSummary;
  catalogueUrl: string;
  noPrerequisites: boolean;
}) {
  const snapshot = useSnapshot();
  const records = useProfileStore((state) => state.records);
  const line = snapshot ? statusLine(course, snapshot, records) : null;
  const terms = partRoutes(course)[0]?.length ?? 0;
  const routes = routesText(course);
  return (
    <div className="mt-4 flex flex-col gap-2">
      {snapshot === undefined && <div aria-hidden className="h-5" />}
      {line && (
        <p className="flex items-start gap-2">
          <span className="flex h-5 shrink-0 items-center">
            <StatusIcon status={line.glyph} />
          </span>
          <span>
            <span className="font-semibold">
              <Term def={{ label: line.word, tip: line.tip }} />
            </span>
            {line.reason && (
              <span className="text-fg-muted"> · {line.reason}</span>
            )}
            {line.uncertain && (
              <span className="ml-2 inline-flex align-top">
                <UncertainFlag />
              </span>
            )}
          </span>
        </p>
      )}
      <p className="flex flex-wrap gap-x-6 gap-y-2 text-fg-muted tabular-nums">
        {course.credits !== null && (
          <span>
            {COPY.credits(course.credits)}
            {terms > 1 && (
              <>
                , <Term def={GLOSSARY.multiTerm}>{terms} terms</Term>
              </>
            )}
          </span>
        )}
        {line?.word !== COPY.notOfferedYear && (
          <span>
            {runsThisYear(course)
              ? course.terms.join(", ")
              : COPY.notOfferedYear}
          </span>
        )}
        {noPrerequisites && <span>No prerequisites</span>}
        <CourseRatings code={course.parts?.[0]?.code ?? course.code} />
        <CatalogueLink href={catalogueUrl} />
      </p>
      {routes && <p className="text-fg-muted">{routes}</p>}
    </div>
  );
}

interface Line {
  glyph: Status;
  word: string;
  tip: string;
  reason?: string;
  uncertain?: boolean;
}

/** Glyph, word and reason for the status line. A planned course needs none, since its button says "Planned for", unless something blocks it. */
function statusLine(
  course: CourseSummary,
  snapshot: Snapshot,
  records: readonly CourseRecord[],
): Line | null {
  const { status, uncertain, blockedBy } = courseStatus(course, snapshot);
  const tree = course.prerequisites?.tree;
  const blockers = [
    blockedBy.length > 0 && COPY.notOpen(blockedBy),
    tree &&
      !meets(tree, snapshot.taken) &&
      COPY.needs(missingText(tree, snapshot.taken)),
  ].filter((reason) => typeof reason === "string");
  const pending = snapshot.pending.get(course.code);
  const locked: Line = {
    glyph: "locked",
    word: STATUS.locked.label,
    tip: STATUS_TIPS.locked,
    reason: blockers.join(" · "),
    uncertain,
  };
  switch (status) {
    case "locked":
      return locked;
    case "planned":
      return blockers.length > 0 ? locked : null;
    case "available": {
      // Say why the red "Add to" button is missing when the next term does not run the course.
      const next = planTermOptions([])[0];
      return runsThisYear(course)
        ? {
            ...locked,
            glyph: status,
            word: STATUS[status].label,
            tip: STATUS_TIPS[status],
            reason:
              next && !isOffered(course, next.season)
                ? COPY.notOfferedIn(next.season)
                : undefined,
          }
        : {
            ...locked,
            glyph: status,
            word: COPY.notOfferedYear,
            tip: STATUS_TIPS[status],
          };
    }
    default: {
      const record = records.find(
        (r) =>
          r.code === course.code &&
          (r.status === "transfer" || r.status === "exemption"),
      );
      const shown = record?.status ?? status;
      return {
        glyph: status,
        word: STATUS[shown].label,
        tip: STATUS_TIPS[shown],
        reason:
          pending && `Credit comes when ${course.code}${pending.last} is done`,
      };
    }
  }
}

/**
 * The page's one action: plan the course in the next term it can start, in any other term to graduation, or take it back out (D30).
 * Red only when the student can take it and it runs next term. Courses taken or in progress have none.
 */
export function AddToPlan({ course }: { course: CourseSummary }) {
  const snapshot = useSnapshot();
  if (snapshot === undefined) return null;
  if (snapshot === null) {
    return (
      <Button asChild>
        <Link href="/profile">{COPY.importTranscript}</Link>
      </Button>
    );
  }
  const { status } = courseStatus(course, snapshot);
  if (
    status === "completed" ||
    status === "covered" ||
    status === "in-progress"
  ) {
    return null;
  }
  return (
    <PlanActions
      course={course}
      open={status === "available" && runsThisYear(course)}
    />
  );
}

function PlanActions({
  course,
  open,
}: {
  course: CourseSummary;
  open: boolean;
}) {
  const catalogue = useCatalogue();
  const plan = useProfileStore((state) => state.plan);
  const graduationTerm = useProfileStore((state) => state.graduationTerm);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const root = useRef<HTMLDivElement>(null);

  const planned = plan.find((entry) =>
    entry.courses.includes(course.code),
  )?.term;
  const ready = catalogue.status === "ready";
  const choices = termChoices(
    course,
    plan,
    ready ? catalogue.catalogue : new Map(),
    graduationTerm,
    currentTerm(),
  ).filter((choice) => !choice.endsAfter);
  const nextTerm = planTermOptions([])[0];
  const next =
    open && !planned && nextTerm
      ? choices.find(
          (choice) =>
            choice.offered && termKey(choice.term) === termKey(nextTerm),
        )
      : undefined;
  const never = !runsThisYear(course);

  // The button the student used is gone after a change, so keep keyboard focus on the menu button that replaces it.
  function add(term: PlanTerm) {
    flushSync(() => addWithUndo(term, course.code));
    root.current?.querySelector("button")?.focus();
  }

  return (
    <div ref={root} className="flex gap-px">
      {next && (
        <Button
          className="rounded-r-none focus-visible:z-10"
          onClick={() => add(next.term)}
        >
          Add to {next.label}
        </Button>
      )}
      <Menu
        align="end"
        trigger={
          next ? (
            <Button
              icon
              aria-label="Choose a term"
              className="rounded-l-none focus-visible:z-10"
            >
              <ChevronDown aria-hidden />
            </Button>
          ) : (
            <Button variant="text" className="-mr-3">
              {planned
                ? `Planned for ${loadsTerms(courseLoads(course.code, course, planned))}`
                : "Add to a term"}
              <ChevronDown aria-hidden className="text-fg-muted" />
            </Button>
          )
        }
      >
        {never && (
          <p className="px-3 py-2 text-fg-muted">{COPY.notOfferedYear}</p>
        )}
        {choices.map((choice) => (
          <TermItem
            key={termKey(choice.term)}
            course={course}
            choice={choice}
            planned={planned}
            limit={ready ? creditLimit : null}
            never={never}
          />
        ))}
        {planned && (
          <MenuItem onSelect={() => removeWithUndo(planned, course.code)}>
            <span className="w-4 shrink-0" />
            Remove from plan
          </MenuItem>
        )}
      </Menu>
    </div>
  );
}

/** One term the course can start in, with the credits the plan holds there (D49). Terms where it does not run stay selectable and the planner warns. */
function TermItem({
  course,
  choice,
  planned,
  limit,
  never,
}: {
  course: CourseSummary;
  choice: TermChoice;
  planned: PlanTerm | undefined;
  /** Null while the catalogue loads and the credits are unknown. */
  limit: number | null;
  never: boolean;
}) {
  const here =
    planned !== undefined && termKey(planned) === termKey(choice.term);
  const over =
    limit !== null &&
    courseLoads(course.code, course, choice.term).some(
      (load, i) => (choice.planned[i] ?? 0) + (here ? 0 : load.credits) > limit,
    );
  const [only] = choice.planned;
  const meta = [
    !choice.offered && !never && COPY.notOffered,
    over && (
      <span key="over" className="flex items-center gap-1 text-warn">
        <TriangleAlert aria-hidden className="size-4" />
        Over limit
      </span>
    ),
    limit !== null &&
      (choice.planned.length === 1 && only !== undefined
        ? COPY.termCredits(only)
        : `${list.format(choice.planned.map(String))} credits`),
  ].filter(Boolean);
  return (
    <MenuItem
      onSelect={() => {
        if (!here) addWithUndo(choice.term, course.code);
      }}
      meta={meta.flatMap((item, i) => (i > 0 ? [" · ", item] : [item]))}
    >
      {planned && (
        <span className="flex w-4 shrink-0">
          {here && <Check aria-hidden className="size-4" />}
        </span>
      )}
      {choice.label}
      {here && <span className="sr-only"> (planned here)</span>}
    </MenuItem>
  );
}
