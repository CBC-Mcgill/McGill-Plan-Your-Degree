"use client";

import { cn } from "cn";
import { ArrowRight, ExternalLink, FileUp, ListChecks } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { seasonsOffered } from "@/components/course-row";
import { CreditsLabel } from "@/components/credits-label";
import { GeneratedBanner } from "@/components/generated-banner";
import {
  STATUS,
  type Status,
  StatusIcon,
  StatusTip,
  UncertainFlag,
} from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import {
  CheckRow,
  coursesTab,
  Group,
  OneOfLabel,
  PageSkeleton,
  Stat,
  SubLabel,
} from "@/components/whats-next";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";
import { hostsCourses, minimumText, reasonFor } from "@/lib/engine/next-view";
import {
  type Claimed,
  type GroupProgress,
  lacking,
  type ProgramProgress,
  programProgress,
} from "@/lib/engine/progress";
import type { Catalogue, Snapshot } from "@/lib/engine/snapshot";
import { creditsText, sentence } from "@/lib/format";
import { GLOSSARY } from "@/lib/glossary";
import { useProfileStore } from "@/lib/profile/store";
import {
  currentTerm,
  planTermOptions,
  termLabel,
} from "@/lib/profile/term-options";
import {
  type CourseRecord,
  isDone,
  type Plan,
  type Term,
} from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
import type {
  ComplementaryGroup,
  Group as GroupDefinition,
  Program,
} from "@/lib/programs/types";

/** How a course stands for this student, and the term it was taken or is planned in. */
interface Fact {
  status: Status;
  term: Term | null;
}

interface Context {
  catalogue: Catalogue;
  snapshot: Snapshot;
  facts: ReadonlyMap<string, Fact>;
  /** The term "Needs MATH 262 first" is judged for: the next one to plan, as on What's next. */
  term: Term;
  source: string;
}

const DONE_ORDER = ["completed", "transfer", "exemption"];

/** The status and term of every course the student has done, is taking or planned. */
function courseFacts(
  records: readonly CourseRecord[],
  plan: Plan,
  snapshot: Snapshot,
): ReadonlyMap<string, Fact> {
  const facts = new Map<string, Fact>();
  for (const { term, courses } of plan) {
    for (const code of courses) facts.set(code, { status: "planned", term });
  }
  for (const [code, term] of snapshot.inProgress) {
    facts.set(code, { status: "in-progress", term });
  }
  const best = new Map<string, CourseRecord>();
  for (const record of records) {
    const before = best.get(record.code);
    if (
      isDone(record.status) &&
      (!before ||
        DONE_ORDER.indexOf(record.status) < DONE_ORDER.indexOf(before.status))
    ) {
      best.set(record.code, record);
    }
  }
  for (const code of snapshot.done) {
    const record = best.get(code);
    facts.set(code, {
      status: snapshot.covered.has(code)
        ? "covered"
        : (record?.status ?? "completed"),
      term: record?.term ?? null,
    });
  }
  return facts;
}

export function Requirements() {
  const snapshot = useSnapshot();
  if (snapshot === null) {
    return (
      <>
        <Header />
        <EmptyState />
      </>
    );
  }
  if (snapshot === undefined) {
    return (
      <>
        <Header />
        <PageSkeleton />
      </>
    );
  }
  return <RequirementsReady snapshot={snapshot} />;
}

function Header() {
  return (
    <div>
      <h1>Requirements</h1>
      <p className="mt-1 text-muted-foreground">
        Where each of your courses counts toward your program, and what is left
        to take. A course counts toward one requirement only.
      </p>
    </div>
  );
}

// Split out so a visitor without a profile does not download the catalogue.
function RequirementsReady({ snapshot }: { snapshot: Snapshot }) {
  const programId = useProfileStore((state) => state.programId);
  const entry = useProfileStore((state) => state.entry);
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const catalogue = useCatalogue();
  const loaded = useProgram(programId);
  const courses = catalogue.status === "ready" ? catalogue.catalogue : null;
  const term = useMemo(() => planTermOptions([])[0] ?? currentTerm(), []);
  const facts = useMemo(
    () => courseFacts(records, plan, snapshot),
    [records, plan, snapshot],
  );
  const progress = useMemo(
    () =>
      loaded && courses
        ? programProgress(loaded, snapshot, courses, {
            inProgress: true,
            planned: true,
            entry,
          })
        : null,
    [loaded, courses, snapshot, entry],
  );

  return (
    <>
      <Header />
      {loaded === null ? (
        <Card className="mt-6 px-5 py-4">
          <Link
            href="/profile#program"
            className="font-medium underline underline-offset-2 hover:text-primary"
          >
            Pick your program
          </Link>{" "}
          to see where your courses count.
        </Card>
      ) : catalogue.status === "error" ? (
        <div className="mt-6">
          <CatalogueError />
        </div>
      ) : loaded && courses && progress ? (
        <Content
          program={loaded}
          progress={progress}
          context={{
            catalogue: courses,
            snapshot,
            facts,
            term,
            source: loaded.source,
          }}
        />
      ) : (
        <PageSkeleton />
      )}
    </>
  );
}

function Content({
  program,
  progress,
  context,
}: {
  program: Program;
  progress: ProgramProgress;
  context: Context;
}) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const { unclaimed } = progress;
  const unclaimedCredits = unclaimed.reduce((sum, c) => sum + c.credits, 0);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <GeneratedBanner program={program} />
        <Card className="overflow-hidden">
          <ProgramHeader program={program} progress={progress} />
          {program.groups.map((definition, i) => {
            const group = progress.groups[i];
            return group ? (
              <GroupSection
                // biome-ignore lint/suspicious/noArrayIndexKey: two groups can share a title and the list never reorders
                key={i}
                group={group}
                definition={definition}
                collapsed={collapsed.has(String(i))}
                onToggle={() => toggle(String(i))}
                context={context}
              />
            ) : null;
          })}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Group
          title="Not counted toward your program"
          info={GLOSSARY.notCounted}
          trailing={
            unclaimed.length > 0
              ? `${unclaimed.length} ${unclaimed.length === 1 ? "course" : "courses"}, ${creditsText(unclaimedCredits)}`
              : undefined
          }
          collapsed={collapsed.has("unclaimed")}
          onToggle={() => toggle("unclaimed")}
        >
          {unclaimed.length > 0 ? (
            sorted(unclaimed).map((claimed) => (
              <ClaimedRow
                key={claimed.code}
                claimed={claimed}
                context={context}
              />
            ))
          ) : (
            <li className="border-border border-t px-4 py-3 text-muted-foreground">
              Every course you have taken or planned counts toward a
              requirement.
            </li>
          )}
        </Group>
      </Card>
    </div>
  );
}

const byCode = (a: Claimed, b: Claimed) => (a.code < b.code ? -1 : 1);
const sorted = (courses: Claimed[]) => [...courses].sort(byCode);

/** The program strip: name, credits counted, and a link to the course lists on the catalogue. */
function ProgramHeader({
  program,
  progress,
}: {
  program: Program;
  progress: ProgramProgress;
}) {
  const { creditsDone, credits } = progress;
  return (
    <div className="flex h-[72px] items-center gap-6 border-border border-b px-5">
      <div className="min-w-0 max-w-72 shrink-0">
        <h2 className="truncate text-sm leading-5" title={program.name}>
          {program.name}
        </h2>
        <p className="text-muted-foreground text-xs leading-4">Program</p>
      </div>
      <ProgressBar
        value={creditsDone}
        max={credits}
        label={`${program.name} progress`}
        valueText={`${creditsDone} of ${credits} credits`}
        className="flex-1"
      />
      <Stat
        value={`${creditsDone} of ${credits} credits`}
        caption="counted so far"
        info={GLOSSARY.requirementCredits}
      />
      <span aria-hidden className="h-8 w-px bg-border" />
      <a
        href={coursesTab(program.source)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1 rounded-sm text-[13px] text-muted-foreground hover:text-foreground hover:underline"
      >
        Catalogue
        <ExternalLink aria-hidden className="size-3" />
        <span className="sr-only">
          {" "}
          page for {program.name} (opens in a new tab)
        </span>
      </a>
    </div>
  );
}

interface Section {
  /** The rule the courses count toward, shown when the group has several rules. */
  rule: number | null;
  courses: Claimed[];
}

/** A complementary group's courses under the first rule that lists them, each course once. Courses no rule hosts come last. */
function sections(
  group: GroupProgress,
  definition: ComplementaryGroup,
): Section[] {
  const byRule = definition.rules.map(() => [] as Claimed[]);
  const rest: Claimed[] = [];
  for (const claimed of group.courses) {
    const matching = group.rules.flatMap((rule, i) =>
      rule.courses.some(({ code }) => code === claimed.code) ? [i] : [],
    );
    const owner =
      matching.find((i) => {
        const rule = definition.rules[i];
        return rule && hostsCourses(rule, undefined);
      }) ?? matching[0];
    (owner === undefined ? rest : byRule[owner])?.push(claimed);
  }
  return [
    ...byRule.map((courses, rule) => ({ rule, courses })),
    { rule: null, courses: rest },
  ].filter((section) => section.courses.length > 0);
}

function GroupSection({
  group,
  definition,
  collapsed,
  onToggle,
  context,
}: {
  group: GroupProgress;
  definition: GroupDefinition;
  collapsed: boolean;
  onToggle: () => void;
  context: Context;
}) {
  // A group whose rules all need a check has no readable credits to count.
  const counted =
    definition.kind === "required" || group.unparsed < group.rules.length;
  return (
    <Group
      title={group.title}
      info={
        definition.kind === "required"
          ? GLOSSARY.required
          : GLOSSARY.complementary
      }
      fraction={
        definition.kind === "required"
          ? {
              done: group.credited
                ? definition.courses.length
                : group.coursesDone,
              of: definition.courses.length,
              unit: "courses",
            }
          : counted
            ? {
                done: Math.min(group.creditsDone, group.credits),
                of: group.credits,
              }
            : undefined
      }
      met={group.satisfied}
      checks={group.unparsed}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {group.credited ? (
        <li className="border-border border-t px-4 py-3 text-muted-foreground">
          Your Quebec CEGEP diploma credits this group, so you do not need to
          take these courses.
        </li>
      ) : definition.kind === "required" ? (
        <RequiredRows group={group} context={context} />
      ) : (
        <ComplementaryRows
          group={group}
          definition={definition}
          context={context}
        />
      )}
    </Group>
  );
}

function RequiredRows({
  group,
  context,
}: {
  group: GroupProgress;
  context: Context;
}) {
  return (
    <>
      {group.courses.map((claimed) => (
        <ClaimedRow key={claimed.code} claimed={claimed} context={context} />
      ))}
      {group.remaining.map((item) =>
        typeof item === "string" ? (
          <MissingRow key={item} code={item} context={context} />
        ) : (
          <li key={item.oneOf.join()} className="border-border border-t">
            <OneOfLabel />
            <ul>
              {item.oneOf.map((code) => (
                <MissingRow key={code} code={code} context={context} />
              ))}
            </ul>
          </li>
        ),
      )}
    </>
  );
}

function ComplementaryRows({
  group,
  definition,
  context,
}: {
  group: GroupProgress;
  definition: ComplementaryGroup;
  context: Context;
}) {
  const titled = definition.rules.length > 1;
  const toGo = lacking(group);
  return (
    <>
      {sections(group, definition).map(({ rule, courses }) => {
        const definitionRule =
          rule === null ? undefined : definition.rules[rule];
        return (
          <Fragment key={rule ?? "other"}>
            {titled && (
              <SubLabel
                left={definitionRule?.title ?? "Other courses"}
                right={
                  definitionRule
                    ? minimumText(definitionRule, group.rules[rule ?? 0])
                    : null
                }
                className="pr-4"
              />
            )}
            {sorted(courses).map((claimed) => (
              <ClaimedRow
                key={claimed.code}
                claimed={claimed}
                context={context}
              />
            ))}
          </Fragment>
        );
      })}
      {toGo && (
        <li className="flex h-11 items-center gap-3 border-border border-t pr-3 pl-4 text-muted-foreground">
          <StatusIcon status="available" />
          <span className="min-w-0 flex-1 truncate" title={toGo}>
            {toGo}
          </span>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href="/next">
              See options
              <ArrowRight aria-hidden />
              <span className="sr-only"> for {sentence(group.title)}</span>
            </Link>
          </Button>
        </li>
      )}
      {definition.rules
        .filter((rule) => rule.unparsed)
        .map((rule, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: two rules can share the same text and the list never reorders
          <CheckRow key={i} text={rule.title} source={context.source} />
        ))}
    </>
  );
}

/** A course that counts, labelled with the student's own status for it. */
function ClaimedRow({
  claimed: { code, credits },
  context: { catalogue, facts },
}: {
  claimed: Claimed;
  context: Context;
}) {
  const { status, term } = facts.get(code) ?? {
    status: "completed" as const,
    term: null,
  };
  const planned = status === "planned" && term;
  return (
    <RowShell
      code={code}
      title={catalogue.get(code)?.title ?? code}
      status={status}
      tip={planned ? `Planned for ${termLabel(term)}.` : undefined}
      caption={
        <span className="flex items-baseline gap-2">
          <span className={cn("font-medium", STATUS[status].text)}>
            {STATUS[status].label}
          </span>
          {term && (
            <span className="text-muted-foreground">{termLabel(term)}</span>
          )}
        </span>
      }
      credits={credits === 0 ? "No credit" : `${credits} cr`}
    />
  );
}

/** A required course the student has not taken or planned, greyed with the reason What's next gives. */
function MissingRow({ code, context }: { code: string; context: Context }) {
  const course = context.catalogue.get(code);
  if (!course) return null;
  const reason = reasonFor(course, context.term, context.snapshot);
  const caption = reason ?? seasonsOffered(course);
  return (
    <RowShell
      muted
      code={code}
      title={course.title}
      uncertain={Boolean(
        course.prerequisites?.unparsed || course.corequisites?.unparsed,
      )}
      status={reason ? "locked" : "available"}
      tip={reason && `${reason}.`}
      caption={
        <span className="line-clamp-2" title={caption}>
          {caption}
        </span>
      }
      credits={<CreditsLabel course={course} />}
    />
  );
}

/** Course row, 44px, the same columns as on What's next without the action. */
function RowShell({
  code,
  title,
  status,
  tip,
  caption,
  credits,
  muted = false,
  uncertain = false,
}: {
  code: string;
  title: string;
  status: Status;
  tip?: string;
  caption: ReactNode;
  credits: ReactNode;
  muted?: boolean;
  uncertain?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex h-11 items-center gap-3 border-border border-t pr-4 pl-4 focus-within:bg-subtle hover:bg-subtle",
        muted && "text-muted-foreground",
      )}
    >
      <StatusTip status={status} reason={tip}>
        <StatusIcon status={status} />
      </StatusTip>
      <Link
        href={`/courses/${courseSlug(code)}`}
        prefetch={false}
        className="-mx-2 flex h-full min-w-0 flex-1 items-center gap-3 rounded-sm px-2 -outline-offset-2"
      >
        <span className="w-[84px] shrink-0 whitespace-nowrap font-semibold tabular-nums">
          {code}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate" title={title}>
            {title}
          </span>
          {uncertain && <UncertainFlag />}
        </span>
        <span className="w-64 shrink-0 text-[13px] text-muted-foreground leading-4">
          {caption}
        </span>
        <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-muted-foreground tabular-nums">
          {credits}
        </span>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-lg bg-muted text-foreground"
      >
        <ListChecks className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-lg">See where your courses count</h2>
      <p className="mt-1 max-w-md text-muted-foreground">
        Import your transcript and this page shows which requirement each of
        your courses counts toward, and what you still need to graduate.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button asChild size="lg">
          <Link href="/profile">
            <FileUp aria-hidden />
            Import your transcript
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/courses">Browse courses</Link>
        </Button>
      </div>
    </Card>
  );
}
