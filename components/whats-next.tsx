"use client";

import { cn } from "cn";
import {
  ChevronDown,
  CircleAlert,
  Compass,
  ExternalLink,
  FileUp,
  Info,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { type ReactNode, useId, useMemo, useState } from "react";
import { CatalogueError } from "@/components/catalogue-error";
import { seasonsOffered } from "@/components/course-row";
import { GeneratedBanner } from "@/components/generated-banner";
import { addWithUndo, removeWithUndo } from "@/components/plan/add-with-undo";
import { StatusIcon, UncertainFlag } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { useCatalogue } from "@/lib/catalogue/client";
import { courseSlug } from "@/lib/catalogue/slug";
import {
  degreeCredits,
  type Exemption,
  earnedCredits,
  exemptionsToReplace,
} from "@/lib/engine/credits";
import {
  type Entry,
  type Item,
  type NextView,
  nextView,
  type OpenGroup,
} from "@/lib/engine/next-view";
import { creditsLabel } from "@/lib/engine/parts";
import { termLoad } from "@/lib/engine/plan";
import type { Snapshot } from "@/lib/engine/snapshot";
import { creditsText, sentence } from "@/lib/format";
import { useProfileStore } from "@/lib/profile/store";
import { planTermOptions, termLabel } from "@/lib/profile/term-options";
import { type Term, termKey } from "@/lib/profile/types";
import { useSnapshot } from "@/lib/profile/use-snapshot";
import { useProgram } from "@/lib/programs/client";
import type { Program } from "@/lib/programs/types";

const TERMS_SHOWN = 4;
const BUCKET_LIMIT = 5;
const OTHER_STEP = 20;
const OTHER = "other";
const NO_COURSES: ReadonlySet<string> = new Set();

interface Context {
  term: Term;
  /** Course code to the term it is planned in. */
  planned: ReadonlyMap<string, Term>;
}

/** Credits toward the whole degree, and exemptions that left credits to make up. */
interface Background {
  degree: { done: number; required: number; advancedStanding: number } | null;
  exemptions: Exemption[];
}

/** A required group with the courses still missing, split into open now and not open yet. */
interface RequiredBlock {
  title: string;
  creditsDone: number;
  credits: number;
  ready: Item[];
  later: Item[];
}

export function WhatsNext() {
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
  return <WhatsNextReady snapshot={snapshot} />;
}

function Header({ term, children }: { term?: Term; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h1>What's next</h1>
        <p className="mt-1 text-muted-foreground">
          The courses you can take{" "}
          {term ? `in ${termLabel(term)}` : "next term"}, and what you still
          need to graduate.
        </p>
      </div>
      {children}
    </div>
  );
}

/** What the plan holds in the chosen term against the credit limit, amber once it goes over. */
function TermLoad({ credits, limit }: { credits: number; limit: number }) {
  const over = credits > limit;
  return (
    <Badge tone={over ? "warn" : "neutral"} size="md">
      {over && <TriangleAlert aria-hidden />}
      {credits} of {limit} credits planned
      {over && <span className="sr-only">, over your credit limit</span>}
    </Badge>
  );
}

// Split out so a visitor without a profile does not download the catalogue.
function WhatsNextReady({ snapshot }: { snapshot: Snapshot }) {
  const programId = useProfileStore((state) => state.programId);
  const entry = useProfileStore((state) => state.entry);
  const advancedStanding = useProfileStore((state) => state.advancedStanding);
  const creditsRequired = useProfileStore((state) => state.creditsRequired);
  const records = useProfileStore((state) => state.records);
  const plan = useProfileStore((state) => state.plan);
  const creditLimit = useProfileStore((state) => state.creditLimit);
  const catalogue = useCatalogue();
  const options = useMemo(() => planTermOptions([]).slice(0, TERMS_SHOWN), []);
  const [picked, setPicked] = useState<number | null>(null);
  const selected =
    options.find((option) => termKey(option) === picked) ?? options[0];

  // Planned courses stay in the lists, so adding one shows "Planned" and the row does not vanish.
  const unplanned = useMemo(
    () => ({ ...snapshot, planned: NO_COURSES }),
    [snapshot],
  );
  const planned = useMemo(
    () =>
      new Map(
        plan.flatMap(({ term, courses }) =>
          courses.map((code) => [code, term] as const),
        ),
      ),
    [plan],
  );
  const courses = catalogue.status === "ready" ? catalogue.catalogue : null;
  const loaded = useProgram(programId);
  const program = loaded ?? null;
  const view = useMemo(
    () =>
      courses && selected && loaded !== undefined
        ? nextView(courses, unplanned, selected, program, entry)
        : null,
    [unplanned, courses, selected, loaded, program, entry],
  );
  const background = useMemo((): Background => {
    const required = degreeCredits(creditsRequired, entry, program);
    return {
      degree:
        courses && required !== null
          ? {
              done: earnedCredits(snapshot, courses) + advancedStanding,
              required,
              advancedStanding,
            }
          : null,
      exemptions: courses ? exemptionsToReplace(records, courses) : [],
    };
  }, [
    courses,
    snapshot,
    creditsRequired,
    entry,
    program,
    advancedStanding,
    records,
  ]);

  return (
    <>
      <Header term={view ? selected : undefined}>
        {view && courses && selected && (
          <div className="flex shrink-0 items-center gap-4">
            <TermLoad
              credits={termLoad(plan, courses, selected)}
              limit={creditLimit}
            />
            <SelectField
              label="Term"
              value={termKey(selected)}
              onChange={(event) => setPicked(Number(event.target.value))}
              className="grid-cols-[auto_10rem] items-center gap-2.5"
            >
              {options.map((option) => (
                <option key={termKey(option)} value={termKey(option)}>
                  {termLabel(option)}
                </option>
              ))}
            </SelectField>
          </div>
        )}
      </Header>

      {catalogue.status === "error" ? (
        <div className="mt-6">
          <CatalogueError />
        </div>
      ) : view && selected ? (
        <Content
          view={view}
          program={program}
          background={background}
          context={{ term: selected, planned }}
          inProgress={snapshot.inProgress.size > 0}
        />
      ) : (
        <PageSkeleton />
      )}
    </>
  );
}

function Content({
  view,
  program,
  background,
  context,
  inProgress,
}: {
  view: NextView;
  program: Program | null;
  background: Background;
  context: Context;
  inProgress: boolean;
}) {
  const label = termLabel(context.term);
  const blocks = useMemo(() => requiredBlocks(view), [view]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set([OTHER]),
  );
  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className="mt-6 flex flex-col gap-6">
      {program && view.progress ? (
        <ProgramSummary
          program={program}
          creditsDone={view.progress.creditsDone}
          credits={view.progress.credits}
          mustTake={view.mustTake.length}
          label={label}
          background={background}
          inProgress={inProgress}
        />
      ) : (
        <Card className="px-5 py-4">
          <Link
            href="/profile#program"
            className="font-medium underline underline-offset-2 hover:text-primary"
          >
            Pick your program
          </Link>{" "}
          to see which required courses you still need.
        </Card>
      )}

      <Card className="overflow-hidden">
        {blocks.map((block) => (
          <Group
            key={block.title}
            title={block.title}
            fraction={{ done: block.creditsDone, of: block.credits }}
            collapsed={collapsed.has(block.title)}
            onToggle={() => toggle(block.title)}
          >
            <ItemRows items={block.ready} context={context} />
            {block.later.length > 0 && (
              <>
                <SubLabel left={`Not open in ${label}`} />
                <ItemRows items={block.later} context={context} />
              </>
            )}
          </Group>
        ))}
        {program && blocks.length === 0 && (
          <p className="px-4 py-3 text-muted-foreground">
            You have taken every required course. Nice work!
          </p>
        )}
        {view.complementary.map((group) => (
          <ComplementaryGroup
            key={group.title}
            group={group}
            source={program?.source}
            collapsed={collapsed.has(group.title)}
            onToggle={() => toggle(group.title)}
            context={context}
          />
        ))}
        <OtherGroup
          entries={view.other}
          collapsed={collapsed.has(OTHER)}
          onToggle={() => toggle(OTHER)}
          context={context}
        />
      </Card>
    </div>
  );
}

const flatten = (items: Item[]) =>
  items.flatMap((item) => ("oneOf" in item ? item.oneOf : [item]));

/** The program's required groups that still have courses to take. */
function requiredBlocks(view: NextView): RequiredBlock[] {
  return (view.progress?.groups ?? []).flatMap((group) => {
    if (group.kind !== "required" || group.credited) return [];
    const mine = new Set(
      group.remaining.flatMap((item) =>
        typeof item === "string" ? [item] : item.oneOf,
      ),
    );
    const owns = (item: Item) =>
      flatten([item]).some(({ course }) => mine.has(course.code));
    const ready = view.mustTake.filter(owns);
    const later = view.later.filter(owns);
    return ready.length + later.length > 0
      ? [
          {
            title: group.title,
            creditsDone: Math.min(group.creditsDone, group.credits),
            credits: group.credits,
            ready,
            later,
          },
        ]
      : [];
  });
}

/** One strip for the program, then the degree credits and any exemption notes under it. */
function ProgramSummary({
  program,
  creditsDone,
  credits,
  mustTake,
  label,
  background: { degree, exemptions },
  inProgress,
}: {
  program: Program;
  creditsDone: number;
  credits: number;
  mustTake: number;
  label: string;
  background: Background;
  inProgress: boolean;
}) {
  return (
    <section aria-labelledby="program" className="flex flex-col gap-3">
      <Card className="flex h-[72px] items-center gap-6 px-5">
        <div className="shrink-0">
          <h2 id="program" className="text-sm leading-5">
            {program.name}
          </h2>
          <p className="text-muted-foreground text-xs leading-4">
            Program progress
          </p>
        </div>
        <ProgressBar
          value={creditsDone}
          max={credits}
          label={`${program.name} progress`}
          valueText={`${creditsDone} of ${credits} credits`}
          className="flex-1"
        />
        <Stat
          value={`${creditsDone} of ${credits}`}
          caption="program credits"
        />
        <span aria-hidden className="h-8 w-px bg-border" />
        <Stat
          value={String(mustTake)}
          caption={`required courses open in ${label}`}
        />
      </Card>
      {(degree || inProgress) && (
        <div className="flex flex-col gap-1 text-[13px]">
          {inProgress && (
            <p className="text-muted-foreground">
              Program credits include the courses you are taking now.
            </p>
          )}
          {degree && (
            <p>
              <span className="font-medium">Earned so far:</span>{" "}
              <span className="tabular-nums">
                {degree.done}
                {degree.required !== credits && ` of ${degree.required}`}{" "}
                credits
              </span>
              {degree.advancedStanding > 0 && (
                <span className="text-muted-foreground">
                  , including {degree.advancedStanding} advanced standing
                  credits
                </span>
              )}
            </p>
          )}
        </div>
      )}
      {exemptions.length > 0 && (
        <ul className="flex flex-col gap-2">
          {exemptions.map(({ code, credits }) => (
            <li key={code}>
              <Banner>
                <Info aria-hidden />
                <span>
                  {code} was exempted without credit. Replace{" "}
                  {credits === null
                    ? "its credits"
                    : `its ${creditsText(credits)}`}{" "}
                  with another course.
                </span>
              </Banner>
            </li>
          ))}
        </ul>
      )}
      <GeneratedBanner program={program} />
    </section>
  );
}

function Stat({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="shrink-0 text-right">
      <p className="font-semibold text-[15px] leading-5 tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground text-xs leading-4">{caption}</p>
    </div>
  );
}

/** Group header band: chevron, name, fraction and ring. */
function Group({
  title,
  fraction,
  checks = 0,
  trailing,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  fraction?: { done: number; of: number };
  /** Rules in the group that need a manual check. */
  checks?: number;
  trailing?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="border-border border-t first:border-t-0"
    >
      <div className="flex h-9 items-center gap-2 bg-subtle px-4">
        <h2
          id={`${id}-title`}
          className="min-w-0 flex-1 text-[13px] leading-[18px]"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-controls={collapsed ? undefined : `${id}-list`}
            className="flex h-9 w-full items-center gap-3 rounded-sm text-left -outline-offset-2"
          >
            <ChevronDown
              aria-hidden
              strokeWidth={2}
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                collapsed && "-rotate-90",
              )}
            />
            <span className="truncate" title={sentence(title)}>
              {sentence(title)}
            </span>
          </button>
        </h2>
        {checks > 0 && (
          <Badge tone="warn">
            <CircleAlert aria-hidden />
            {checks === 1 ? "1 rule to check" : `${checks} rules to check`}
          </Badge>
        )}
        {fraction && (
          <>
            <span className="text-[13px] text-muted-foreground tabular-nums">
              {fraction.done} of {fraction.of} credits
            </span>
            <ProgressRing
              value={fraction.done}
              max={fraction.of}
              label={`${fraction.done} of ${fraction.of} credits`}
            />
          </>
        )}
        {trailing && (
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {trailing}
          </span>
        )}
      </div>
      {!collapsed && <ul id={`${id}-list`}>{children}</ul>}
    </section>
  );
}

function SubLabel({ left, right }: { left: string; right?: string | null }) {
  return (
    <li className="flex h-8 items-center justify-between gap-4 border-border border-t pr-[108px] pl-[42px] font-medium text-muted-foreground text-xs leading-4">
      <span className="truncate">{left}</span>
      {right && <span className="tabular-nums">{right}</span>}
    </li>
  );
}

function ItemRows({ items, context }: { items: Item[]; context: Context }) {
  return items.map((item) =>
    "oneOf" in item ? (
      <li
        key={item.oneOf.map(({ course }) => course.code).join()}
        className="border-border border-t"
      >
        <p className="flex h-7 items-center bg-subtle pl-[42px] font-medium text-in-progress text-xs leading-4">
          Take one of these
        </p>
        <ul>
          {item.oneOf.map((entry) => (
            <Row key={entry.course.code} entry={entry} context={context} />
          ))}
        </ul>
      </li>
    ) : (
      <Row key={item.course.code} entry={item} context={context} />
    ),
  );
}

/** Course row, 44px. The action stays hidden until hover or focus, so the list is quiet at rest. */
function Row({
  entry: { course, uncertain, reason },
  context: { term, planned },
}: {
  entry: Entry;
  context: Context;
}) {
  const plannedIn = planned.get(course.code);
  const here = plannedIn && termKey(plannedIn) === termKey(term);
  const [pops, setPops] = useState(0);
  const status = plannedIn ? "planned" : reason ? "locked" : "available";
  const plannedText = plannedIn && `Planned for ${termLabel(plannedIn)}`;
  const caption =
    plannedIn && !here ? plannedText : (reason ?? seasonsOffered(course));
  const showAction = here || (!plannedIn && !reason);

  return (
    <li
      className={cn(
        "group/row flex h-11 items-center gap-3 border-border border-t pr-3 pl-4 focus-within:bg-subtle hover:bg-subtle",
        status === "locked" && "text-muted-foreground",
      )}
    >
      <motion.span
        key={pops}
        initial={pops > 0 ? { scale: 0.5 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.15, bounce: 0.5 }}
        className="flex shrink-0"
      >
        <StatusIcon status={status} label={plannedText} />
      </motion.span>
      <Link
        href={`/courses/${courseSlug(course.code)}`}
        prefetch={false}
        className="-mx-2 flex h-full min-w-0 flex-1 items-center gap-3 rounded-sm px-2 -outline-offset-2"
      >
        <span className="w-[76px] shrink-0 font-semibold tabular-nums">
          {course.code}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate" title={course.title}>
            {course.title}
          </span>
          {uncertain && <UncertainFlag />}
        </span>
        <span
          className="line-clamp-2 w-64 shrink-0 text-[13px] text-muted-foreground leading-4"
          title={caption}
        >
          {caption}
        </span>
        <span className="w-24 shrink-0 whitespace-nowrap text-right text-[13px] text-muted-foreground tabular-nums">
          {creditsLabel(course)}
        </span>
      </Link>
      <span className="flex w-[84px] shrink-0 justify-end">
        {showAction && (
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
            onClick={() => {
              if (here) {
                removeWithUndo(term, course.code);
              } else {
                setPops((n) => n + 1);
                addWithUndo(term, course.code);
              }
            }}
          >
            {here ? <X aria-hidden /> : <Plus aria-hidden />}
            {here ? "Remove" : "Add"}
            <span className="sr-only">
              {" "}
              {course.code} {here ? "from" : "to"} {termLabel(term)}
            </span>
          </Button>
        )}
      </span>
    </li>
  );
}

/** A rule the crawler could not read. It shows the catalogue text and links to the program page, and never counts as done. */
function CheckRow({
  text,
  source,
}: {
  text: string;
  source: string | undefined;
}) {
  return (
    <li className="flex min-h-11 items-center gap-3 border-border border-t py-2 pr-3 pl-4">
      <CircleAlert
        aria-hidden
        strokeWidth={2}
        className="size-4 shrink-0 text-warn"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Check this requirement</p>
        <p
          className="line-clamp-2 text-[13px] text-muted-foreground leading-4"
          title={text}
        >
          {text}
        </p>
      </div>
      {source && (
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <a href={source} target="_blank" rel="noopener noreferrer">
            Program page
            <ExternalLink aria-hidden />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      )}
    </li>
  );
}

function ShowMore({
  hidden,
  step,
  onClick,
}: {
  hidden: number;
  step: number;
  onClick: () => void;
}) {
  return (
    <li className="flex h-10 items-center border-border border-t pl-8">
      <Button variant="ghost" size="sm" onClick={onClick}>
        {hidden > step ? "Show more" : `Show ${hidden} more`}
      </Button>
    </li>
  );
}

function ComplementaryGroup({
  group,
  source,
  collapsed,
  onToggle,
  context,
}: {
  group: OpenGroup;
  source: string | undefined;
  collapsed: boolean;
  onToggle: () => void;
  context: Context;
}) {
  return (
    <Group
      title={group.title}
      fraction={
        group.counted
          ? { done: group.creditsDone, of: group.credits }
          : undefined
      }
      checks={group.checks.length}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {group.checks.map((text) => (
        <CheckRow key={text} text={text} source={source} />
      ))}
      {group.buckets.map((bucket) => (
        <Bucket
          key={bucket.title}
          title={group.titled ? bucket.title : null}
          progress={bucket.progress}
          entries={bucket.entries}
          context={context}
        />
      ))}
    </Group>
  );
}

function Bucket({
  title,
  progress,
  entries,
  context,
}: {
  title: string | null;
  progress: string | null;
  entries: Entry[];
  context: Context;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, BUCKET_LIMIT);
  const hidden = entries.length - shown.length;
  return (
    <>
      {title && <SubLabel left={title} right={progress} />}
      {shown.map((entry) => (
        <Row key={entry.course.code} entry={entry} context={context} />
      ))}
      {hidden > 0 && (
        <ShowMore hidden={hidden} step={hidden} onClick={() => setAll(true)} />
      )}
    </>
  );
}

function OtherGroup({
  entries,
  collapsed,
  onToggle,
  context,
}: {
  entries: Entry[];
  collapsed: boolean;
  onToggle: () => void;
  context: Context;
}) {
  const [limit, setLimit] = useState(OTHER_STEP);
  const shown = entries.slice(0, limit);
  const hidden = entries.length - shown.length;
  return (
    <Group
      title="Other courses you can take"
      trailing={`${entries.length.toLocaleString()} courses`}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {shown.map((entry) => (
        <Row key={entry.course.code} entry={entry} context={context} />
      ))}
      {hidden > 0 && (
        <ShowMore
          hidden={hidden}
          step={OTHER_STEP}
          onClick={() => setLimit((n) => n + OTHER_STEP)}
        />
      )}
      {entries.length === 0 && (
        <li className="border-border border-t px-4 py-3 text-muted-foreground">
          Nothing else is open to you in {termLabel(context.term)}.
        </li>
      )}
    </Group>
  );
}

function EmptyState() {
  return (
    <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-lg bg-muted text-foreground"
      >
        <Compass className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-lg">See what you can take next</h2>
      <p className="mt-1 max-w-md text-muted-foreground">
        Import your transcript and this page lists the courses you can take next
        term, and the ones you still need to graduate.
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

function PageSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <p role="status" className="sr-only">
        Loading your courses
      </p>
      <Card aria-hidden className="flex h-[72px] items-center px-5">
        <div className="h-5 w-60 rounded-sm bg-muted motion-safe:animate-pulse" />
      </Card>
      <Card aria-hidden className="overflow-hidden">
        <div className="h-9 bg-subtle" />
        {Array.from({ length: 6 }, (_, row) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
            key={row}
            className="flex h-11 items-center gap-4 border-border border-t px-4"
          >
            <div className="h-4 w-20 rounded-sm bg-muted motion-safe:animate-pulse" />
            <div className="h-4 flex-1 rounded-sm bg-muted motion-safe:animate-pulse" />
          </div>
        ))}
      </Card>
    </div>
  );
}
