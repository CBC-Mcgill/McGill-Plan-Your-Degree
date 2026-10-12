import * as cheerio from "cheerio";
import { isReminder, ruleMatches } from "../lib/engine/progress.ts";
import { logicalCode } from "../lib/profile/types.ts";
import { isMinor } from "../lib/programs/minor.ts";
import type {
  ComplementaryGroup,
  Group,
  Match,
  Program,
  RequiredGroup,
  RequiredItem,
  Rule,
} from "../lib/programs/types.ts";
import { BASE_URL } from "./fetch.ts";

export interface ParseOptions {
  /** Subject codes a department offers, looked up by its lowercase name such as "computer science". */
  subjectsOf?: (department: string) => string[];
}

type Q = ReturnType<cheerio.CheerioAPI>;
interface Row {
  codes: string[];
  /** The codes as printed, so ECSE 458D1 and ECSE 458D2 stay two parts of ECSE 458. */
  printed: string[];
  credits: number;
  or: boolean;
}
interface Table {
  kind: "table";
  rows: Row[];
  notes: string[];
}
interface Text {
  kind: "text";
  text: string;
}
interface Section {
  kind: "section";
  level: number;
  title: string;
  /** Credits from the heading, as a range. */
  min?: number;
  max?: number;
  items: (Section | Table | Text)[];
}
type Event = { kind: "heading"; text: string } | Text | Table;

const clean = (text: string) =>
  text
    .replace(/[\u200b\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const trimEnd = (text: string) => text.replace(/[\s:;.]+$/, "");
const CODE = String.raw`[A-Z]{3}[A-Z\d] \d{3}(?:[DJN]\d)?`;
const CODE_G = new RegExp(String.raw`\b${CODE}\b`, "g");
const codesIn = (text: string) =>
  [...text.matchAll(CODE_G)].map((m) => logicalCode(m[0]));
const skeleton = (text: string) => text.replace(CODE_G, "CODE");
const NUM = String.raw`(\d+(?:\.\d+)?)`;
const RANGE = String.raw`${NUM}(?:\s*[-–]\s*${NUM})?`;
// A range as headings and amounts write it: "6-9", "3 or 4", "6 to 7", and on French pages "12 à 18".
const SPAN = String.raw`${NUM}(?:\s*(?:[-–]|or|to|à)\s*${NUM})?`;
const CREDITS = "cr[eé]dits?";
const sentences = (text: string) =>
  text
    .split(/(?<=[.:;])\s+(?=[A-Z(])/)
    .map(clean)
    .filter(Boolean);

/** The catalogue year the page belongs to, such as 2026-2027. */
export function catalogueYear(html: string): string | null {
  return (
    /(\d{4}-\d{4}) (?:Undergraduate|Graduate) Catalogue/.exec(html)?.[1] ?? null
  );
}

const HEADING_CREDITS = new RegExp(
  String.raw`\s*\(\s*${SPAN}\s*${CREDITS}\s*\)\s*$`,
  "i",
);

function splitHeading(text: string) {
  const m = HEADING_CREDITS.exec(text);
  return {
    title: clean(text.replace(HEADING_CREDITS, "")),
    min: m ? Number(m[1]) : undefined,
    max: m ? Number(m[2] ?? m[1]) : undefined,
  };
}

function readRow(tr: Q): Row | null {
  const cell = clean(tr.children("td.codecol").text());
  const codes = codesIn(cell.replace(/^or\s+/i, ""));
  if (codes.length === 0) return null;
  return {
    codes,
    printed: [...cell.matchAll(CODE_G)].map((m) => m[0]),
    credits: Number(clean(tr.children("td.hourscol").text())) || 0,
    or: /^or\s/i.test(cell) || tr.hasClass("orclass"),
  };
}

/** Flattens the Courses tab into a tree of headings holding paragraphs, tables and their footnotes, in page order. */
function readSections($: cheerio.CheerioAPI, container: Q): Section[] {
  $(".sc_courseinline").each((_, el) => {
    $(el).replaceWith($(el).find("a.code").first().text() || $(el).text());
  });
  const text = (el: Q) => clean(el.clone().find("sup").remove().end().text());
  const root: Section = { kind: "section", level: 1, title: "", items: [] };
  const stack = [root];
  let lastList: { kind: string; letter: number; level: number } | undefined;
  let adopted: number | undefined;
  const add = (item: Section | Table | Text) => {
    stack.at(-1)?.items.push(item);
  };
  const walk = (parent: Q) => {
    for (const child of parent.children().toArray()) {
      const el = $(child);
      const tag = child.tagName;
      if (/^h[2-6]$/.test(tag)) {
        let level = Number(tag[1]);
        const id = /^(Group|List) ([A-Z])\b/.exec(text(el));
        const kind = id?.[1] ?? "";
        const letter = id?.[2]?.charCodeAt(0) ?? 0;
        // "Group B" one level above the "Group A" right before it slipped out of its list.
        if (
          lastList?.kind === kind &&
          lastList.letter + 1 === letter &&
          level < lastList.level
        ) {
          level = lastList.level;
        }
        lastList = id ? { kind, letter, level } : undefined;
        if (adopted !== undefined && level < adopted) adopted = undefined;
        // An empty "Required Courses (44 credits)" above headings of its own level heads them, until the next "... Courses (N credits)".
        const top = /\bcourses?\b.*\bcredits?\)$/i.test(text(el));
        if (level === adopted) level = top ? 2 : 3;
        else if (
          level > 2 &&
          top &&
          /^required\b/i.test(text(el)) &&
          el.next().is(tag)
        ) {
          adopted = level;
          level = 2;
        }
        while (stack.length > 1 && (stack.at(-1)?.level ?? 0) >= level) {
          stack.pop();
        }
        const section: Section = {
          kind: "section",
          level,
          ...splitHeading(text(el)),
          items: [],
        };
        add(section);
        stack.push(section);
      } else if (tag === "table") {
        const rows = el
          .find("tr")
          .not(".bubbledrawer")
          .map((_, tr) => readRow($(tr)))
          .get();
        add({ kind: "table", rows, notes: [] });
      } else if (tag === "dl") {
        const last = stack.at(-1)?.items.findLast((i) => i.kind === "table");
        for (const dd of el.children("dd").toArray()) {
          const note = text($(dd));
          if (last?.kind === "table") last.notes.push(note);
          else add({ kind: "text", text: note });
        }
      } else if (tag === "ul" || tag === "ol") {
        for (const li of el.children("li").toArray()) {
          add({ kind: "text", text: text($(li)) });
        }
      } else if (el.find("table, h2, h3, h4, p").length > 0) {
        walk(el);
      } else if (!["button", "a", "script"].includes(tag)) {
        add({ kind: "text", text: text(el) });
      }
    }
  };
  walk(container);
  const drop = (section: Section) => {
    section.items = section.items.filter(
      (item) => item.kind !== "text" || item.text,
    );
    // "(18-19 credits)" on its own line under a heading is the heading's.
    const [first] = section.items;
    const credits =
      first?.kind === "text" && section.min === undefined
        ? new RegExp(String.raw`^\(\s*${SPAN}\s*${CREDITS}\s*\)$`, "i").exec(
            first.text,
          )
        : null;
    if (credits) {
      section.min = Number(credits[1]);
      section.max = Number(credits[2] ?? credits[1]);
      section.items.shift();
    }
    for (const item of section.items) if (item.kind === "section") drop(item);
  };
  drop(root);
  adoptStreams(root.items);
  return root.items.filter((item) => item.kind === "section");
}

/** "27 credits from one of the following two streams:" ending a section owns the stream headings that slipped out after it, at any level. */
function adoptStreams(items: (Section | Table | Text)[]) {
  for (let i = 0; i < items.length; i++) {
    const section = items[i];
    if (section?.kind !== "section") continue;
    let holder = section;
    for (let last = holder.items.at(-1); last?.kind === "section"; ) {
      holder = last;
      last = holder.items.at(-1);
    }
    const last = holder.items.at(-1);
    const m = last?.kind === "text" ? STREAMS.exec(last.text) : null;
    const after = items.slice(i + 1);
    const end = after.findIndex(
      (s) => s.kind !== "section" || !/\bstream\b/i.test(s.title),
    );
    const streams = after.slice(0, end < 0 ? after.length : end);
    const count = COUNTS[(m?.[3] ?? "").toLowerCase()];
    if (
      m?.[4]?.toLowerCase() === "streams" &&
      streams.length >= 2 &&
      (count === undefined || streams.length === count)
    ) {
      holder.items.push(...streams);
      items.splice(i + 1, streams.length);
    }
    adoptStreams(section.items);
  }
}

/** Headings, paragraphs and tables of a section and everything under it, in page order. */
function events(section: Section): Event[] {
  return section.items.flatMap((item): Event[] =>
    item.kind === "section"
      ? [{ kind: "heading", text: item.title }, ...events(item)]
      : [item],
  );
}

const COUNTS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};
const COUNT_WORD = "one|two|three|four|five|six";
const LEADS: Record<string, "min" | "max"> = {
  "at least": "min",
  "a minimum of": "min",
  "minimum of": "min",
  minimum: "min",
  "au moins": "min",
  "up to": "max",
  "at most": "max",
  "a maximum of": "max",
  "maximum of": "max",
  "no more than": "max",
};
const AMOUNT = new RegExp(
  String.raw`^(at least |au moins |a minimum of |minimum of |minimum |up to |at most |a maximum of |maximum of |no more than )?${SPAN}\s*${CREDITS}(?:\s*\(\s*(\d+|${COUNT_WORD})(?:\s*[-–]\s*(\d+))?\s*courses?\s*\))?`,
  "i",
);
// Who takes the list, in front of the amount: "Students must take at least 3 credits from the following courses".
const LIST_LEAD =
  /^(?:(?:all )?students (?:in this stream )?(?:must |should |will |may also )?(?:take|complete|select|choose)(?: \(or have taken\))? |select |plus |and |part [ivx]+: |de )/i;
const FROM_UNION =
  /^,?\s*(?:selected |chosen )?from the following list or the previous(?: list)?\s*[:.]?$/i;
// Advice in parentheses that does not change which courses count.
const LIST_ADVICE =
  /\s*\((?:(?:usually|normally|ordinarily|recommended|highly recommended|or (?:their )?equivalents?)\b[^()]*|\d+ credits? per (?:term|semester))\)/gi;
// Words that change nothing: "9 credits ordinarily selected from", "of Arabic language (3 levels)", "from courses not taken above and the following".
const LIST_FILLER =
  /\s*\(\d+ levels\)|\b(?:ordinarily|usually|normally) |\bcourses not (?:already )?taken above and |\bor (?:their )?equivalents?\b/gi;
// "of Geography courses at the 200 level" names the part of the list that counts.
const AT_LEVEL =
  /\s*\bat the ([1-5]00)(?: or ([1-5]00))?[- ]level( or (?:above|higher))?/i;
// Words that add a condition the amount alone would hide, so a statement that has one stays unparsed.
const UNREAD =
  /\d|«|\b(?:au moins|blocs?|séries?|chaque|seulement|autres?|sauf|least|most|max(?:imum)?|min(?:imum)?|each|any|only|must|not|no|except|excluding|other|others|another|either|both|permission|consultation|approv\w*|substitut\w*|students?|student's|if|per|additional|remaining|remainder|levels?|groups?|streams?|areas?|categor\w*|options?|forms?|plans?|one|two|three|four|five|six|outside|home|department\w*|previous|preceding|above|elsewhere|offerings?|prefix\w*|subject|combination|includ\w*|total|semesters?|terms?|years?|assigned|audition|note|instead|replace\w*|sets?|requirements?|specifications?|stipulations?|see|prerequisites?)\b/i;
// The statement points at the table that follows: "selected from:", "from the following list of common law courses:", "of:".
const POINTER =
  /\b(?:from|among|parmi)\b|\bthe following\b|\bsuivants?\b|\b(?:of|in)$|\bas follows$/i;

interface Amount {
  minCredits?: number;
  maxCredits?: number;
  minCourses?: number;
  maxCourses?: number;
}

/** A second condition on part of a list, such as "at least 6 of which must be ATOC" or "with at least 3 credits at the 400 level". */
interface Part {
  title: string;
  minCredits: number;
  maxCredits?: number;
  subjects?: string[];
  level?: Match;
  /** A labelled list such as "block a", for "3 credits from each of Blocks A, B and C". */
  list?: string;
}

const LIST_IDS = String.raw`(?:Group|List|Block)s? [A-Z\d](?:(?:, | and |, and | or |, or )(?:(?:Group|List|Block) )?[A-Z\d])*`;

/** "Groups A, B and C" as ["group a", "group b", "group c"]. */
function listIds(text: string): string[] {
  const kind = /^(group|list|block)/i.exec(text)?.[1]?.toLowerCase();
  return [
    ...text
      .replace(/^(?:Group|List|Block)s?\s*/i, "")
      .matchAll(/\b([A-Z\d])\b/g),
  ].map((m) => `${kind} ${(m[1] ?? "").toLowerCase()}`);
}

/** The id of a heading such as "Block A-Ecology and Evolution" or "List B: Botany". */
const listId = (title: string) => {
  const m = /^(Group|List|Block) ([A-Z\d])\b/i.exec(title);
  return m ? `${m[1]?.toLowerCase()} ${m[2]?.toLowerCase()}` : undefined;
};

function amountOf(m: RegExpExecArray): Amount {
  const lead = LEADS[(m[1] ?? "").trim().toLowerCase()];
  const low = Number(m[2]);
  const amount: Amount = {};
  if (lead === "min") amount.minCredits = low;
  else if (lead === "max") amount.maxCredits = low;
  else {
    if (low > 0) amount.minCredits = low;
    amount.maxCredits = m[3] === undefined ? low : Number(m[3]);
  }
  if (m[4] !== undefined) {
    const courses = COUNTS[m[4].toLowerCase()] ?? Number(m[4]);
    amount.minCourses = courses;
    amount.maxCourses = m[5] === undefined ? courses : Number(m[5]);
  }
  return amount;
}

const PART_SUBJECT =
  /^(?:of which )?(?:[Aa]t least )?(\d+)(?: credits)?(?: of which)? must be (?:from )?(?:an? )?(?:course with an? )?([A-Z]{3}[A-Z\d])(?: prefix| courses?)?$/;
const PART_EACH =
  /^with at least (\d+) credits from each of (?:the )?subject codes ([A-Z]{3}[A-Z\d](?:(?:, | and |, and )[A-Z]{3}[A-Z\d])*)$/;
const PART_LEVEL = new RegExp(
  String.raw`^(?:with |of which )?(?:at least |a minimum of )?${SPAN}(?: of the \d+)? credits (?:must |should )?(?:be )?(?:taken )?at the (\d{3})(?: or (\d{3}))?[- ]level(?: or (?:above|higher))?$`,
  "i",
);

const PART_LISTS = new RegExp(
  String.raw`^(?:at least )?(\d+) credits from each of (?:the )?(${LIST_IDS})$`,
  "i",
);

function partOf(text: string): Part[] | null {
  const clause = clean(text);
  const title = clause
    .replace(/^(?:of which|with) /i, "")
    .replace(/^./, (c) => c.toUpperCase());
  const subject = PART_SUBJECT.exec(clause);
  if (subject) {
    return [
      {
        title,
        minCredits: Number(subject[1]),
        subjects: [subject[2] ?? ""],
      },
    ];
  }
  const lists = PART_LISTS.exec(clause);
  if (lists) {
    return listIds(lists[2] ?? "").map((list) => ({
      title: `At least ${lists[1]} credits from ${sentenceCase(list)}`,
      minCredits: Number(lists[1]),
      list,
    }));
  }
  const each = PART_EACH.exec(clause);
  if (each) {
    return (each[2] ?? "").split(/, and |, | and /).map((s) => ({
      title: `At least ${each[1]} credits of ${s}`,
      minCredits: Number(each[1]),
      subjects: [s],
    }));
  }
  const level = PART_LEVEL.exec(clause);
  if (level) {
    const low = Number(level[3]);
    const exact = !/or (?:above|higher)$/i.test(clause) && !level[4];
    return [
      {
        title,
        minCredits: Number(level[1]),
        ...(level[2] !== undefined && { maxCredits: Number(level[2]) }),
        level: exact ? { minLevel: low, maxLevel: low } : { minLevel: low },
      },
    ];
  }
  return null;
}

/** The part of a list a qualifier names, or null when none of its courses fit. */
function partCourses(
  part: Part,
  courses: string[],
  lists: ReadonlyMap<string, string[]>,
): string[] {
  if (part.list) return lists.get(part.list) ?? [];
  return courses.filter((code) => {
    const [subject = "", number = ""] = code.split(" ");
    const level = Math.floor(Number(number) / 100) * 100;
    return (
      (!part.subjects || part.subjects.includes(subject)) &&
      (!part.level ||
        ((part.level.minLevel === undefined || level >= part.level.minLevel) &&
          (part.level.maxLevel === undefined || level <= part.level.maxLevel)))
    );
  });
}

/** `union` takes in the list right before, "above" every list before it in the group. */
type ListAmount = Amount & { union?: true | "above"; parts?: Part[] };

/** A line that opens a list to a subject at a level, before it as "Any course at the 300, 400 or 500 level from the department of Linguistics, or from the following list:" or after it as "COMP courses at the 300 level or above except COMP 396, COMP 400". */
function widening(
  text: string,
  subjectsOf: (department: string) => string[],
): Match | null {
  const before =
    /^any course (.+?) from the department of ([A-Za-z ]+?),? or(?: from the following list)?\s*:$/i.exec(
      text,
    );
  const after = new RegExp(
    String.raw`^([A-Z]{3}[A-Z\d]) courses (at the .+?)(?:,? (?:except|excluding) (${CODE}(?:(?:,? and |, |,? or )${CODE})*))?\.?$`,
  ).exec(text);
  const at = before?.[1] ?? after?.[2];
  const level = at === undefined ? null : levelIn(at);
  const subjects = before
    ? subjectsOf((before[2] ?? "").toLowerCase())
    : [after?.[1] ?? ""];
  if (
    !level ||
    at?.replace(level.phrase, "").trim() !== "at" ||
    !subjects.every(Boolean) ||
    subjects.length === 0
  ) {
    return null;
  }
  const match: Match = { subjects, ...level.match };
  if (after?.[3]) match.exclude = codesIn(after[3]);
  return match;
}

/** "3-9 credits selected from:", "12 credits of advanced anatomy courses (AAC) selected from:" or "One of:" in front of a table. `adjacent` also takes a plain "9 credits of systematic physical geography" right above its table. */
function listAmount(text: string, adjacent = false): ListAmount | null {
  if (bareTotal(text)) return null;
  // "selected from the list below. At least 6 credits must be taken at the 400 or 500 level."
  const [first = "", second, ...more] = sentences(text);
  const extra = second
    ? partOf(trimEnd(second).replace(/^of these \d+ credits,\s*/i, ""))
    : [];
  if (!extra || more.length > 0) return null;
  const found = statementAmount(first, adjacent && !second);
  if (!found || extra.length === 0) return found;
  return { ...found, parts: [...(found.parts ?? []), ...extra] };
}

function statementAmount(
  statement: string,
  adjacent: boolean,
): ListAmount | null {
  // "300-level complementary courses: 6 credits from the following" names the list before its amount.
  const text = statement.replace(/^(?!note\b)[^:.;]{1,60}:\s+(?=\d)/i, "");
  const lead = LIST_LEAD.exec(text)?.[0] ?? "";
  const body = text.slice(lead.length);
  const m = AMOUNT.exec(body);
  const courses = new RegExp(
    `^(${COUNT_WORD}) courses? (?=selected|chosen|from|in)`,
    "i",
  ).exec(body);
  if (!m && !courses) {
    const one = new RegExp(
      String.raw`^(${COUNT_WORD}) of(?: the following)?(?:[\w\s-]*?courses?)?(?: below)?(?: or (?:their )?equivalents?)?(?: \([^)]*\))?\s*[:.]?$`,
      "i",
    ).exec(text);
    const n = one && COUNTS[(one[1] ?? "").toLowerCase()];
    return n ? { minCourses: n, maxCourses: n } : null;
  }
  let rest = body
    .slice((m ?? courses)?.[0].length)
    .replace(LIST_ADVICE, "")
    .replace(LIST_FILLER, "")
    .replace(/\s*\*+/g, "");
  if (FROM_UNION.test(rest)) return m && { ...amountOf(m), union: true };
  // "3 credits, one of:", "3 credits in Biochemistry, one of:", "3 credits from one of the following Statistics courses:"
  const count = new RegExp(
    String.raw`^(?:\s+(?:in|of) ([^,]+))?(,)?\s*(?:select |from )?(${COUNT_WORD}) (?:of|from)(?: the following)?((?: [\w/-]+?)*? courses?)?\s*[:.]?$`,
    "i",
  ).exec(rest);
  if (
    m &&
    count &&
    (count[2] || count[4]) &&
    !UNREAD.test(`${count[1] ?? ""} ${count[4] ?? ""}`)
  ) {
    const n = COUNTS[(count[3] ?? "").toLowerCase()];
    return { ...amountOf(m), minCourses: n, maxCourses: n };
  }
  const parts: Part[] = [];
  let unread = false;
  // "3 credits minimum of statistics" and "6 credits (minimum) in" set only a floor.
  const floor = /^\s*(?:\(minimum\)|minimum\b)/i.exec(rest);
  rest = rest
    .slice(floor?.[0].length ?? 0)
    .replace(/\s*\(([^()]*)\)/g, (whole, inner: string) => {
      const part = partOf(inner);
      if (part) parts.push(...part);
      else if (UNREAD.test(inner)) unread = true;
      return part ? "" : whole;
    })
    .replace(
      /(?:[,:]\s*|\s+)((?:of which|with|at least)\b(?=.*\d).*?)\s*[:.]?$/i,
      (_, clause) => {
        const part = partOf(clause);
        if (part) parts.push(...part);
        else unread = true;
        return "";
      },
    )
    .replace(/\b(?:must|to) be (?=chosen|selected|taken)/i, "")
    .replace(/\s*[:.]?\s*$/, "");
  const level = AT_LEVEL.exec(rest);
  rest = rest.replace(AT_LEVEL, "");
  // "from the following list of 400- and 500-level courses" names the level of the list.
  const listOf =
    /\blist of ((?:[1-5]00-?(?:,? (?:and|or) |, )?)+level) courses\b/i.exec(
      rest,
    );
  const listLevel = listOf ? levelIn(listOf[1] ?? "") : null;
  if (listOf && listLevel) rest = rest.replace(listOf[0], "list");
  const colon = /:\s*$/.test(text.replace(/\s*\*+\s*$/, ""));
  if (
    unread ||
    UNREAD.test(rest) ||
    /\b(?:List|Block) [A-Z\d]\b/.test(rest) ||
    !(POINTER.test(rest) || adjacent || colon) ||
    !/^(?:,?\s*(?:are |is )?(?:selected|chosen|taken|from|among|of|in|on|for|choisis|parmi)\b|$)/i.test(
      rest,
    )
  ) {
    return null;
  }
  if (!m) {
    const n = COUNTS[(courses?.[1] ?? "").toLowerCase()];
    return { minCourses: n, maxCourses: n };
  }
  const amount = amountOf(m);
  if (floor) delete amount.maxCredits;
  if (listOf && listLevel && amount.minCredits !== undefined) {
    parts.push({
      title: `${m[0]} at the ${listOf[1]}`,
      minCredits: amount.minCredits,
      level: listLevel.match,
    });
  }
  if (level) {
    if (amount.minCredits === undefined) return null;
    parts.push({
      title: `${m[0]} ${level[0].trim()}`,
      minCredits: amount.minCredits,
      level: level[3]
        ? { minLevel: Number(level[1]) }
        : {
            minLevel: Number(level[1]),
            maxLevel: Number(level[2] ?? level[1]),
          },
    });
  }
  return {
    ...amount,
    ...(parts.length > 0 && { parts }),
    // "12 credits selected from courses not taken above and the following:".
    ...(/\bcourses not (?:already )?taken above and /i.test(body) && {
      union: "above" as const,
    }),
  };
}

/** A total with nothing to choose from, such as "9-12 credits (3 courses) must be taken, chosen as follows:". */
const BARE_TOTAL = new RegExp(
  String.raw`^(?:students (?:must |should )?(?:choose|select|take) )?${SPAN}\s*credits?(?:\s*\(\s*${NUM}(?:\s*[-–]\s*\d+)?\s*courses?\s*\))?(?:,?\s*as follows|,?\s*(?:must be taken|(?:are )?selected|distributed|chosen|of complementary courses (?:are )?selected|all of the courses below|from one or more of the following (?:groups|lists))(?:,?\s*(?:chosen |selected )?(?:as follows|as described below)(?:,?\s*in consultation with[^:.]*)?)?)?\s*[:.]?$`,
  "i",
);

function bareTotal(text: string) {
  const m = BARE_TOTAL.exec(text);
  return m
    ? {
        credits: Number(m[1]),
        minCourses: m[3] === undefined ? undefined : Number(m[3]),
      }
    : null;
}

const SUBJECT_LIST = String.raw`[A-Z]{3}[A-Z\d](?:(?:, | or | and |, or |, and )[A-Z]{3}[A-Z\d])*`;
const subjectsIn = (text: string) => text.split(/, or |, and |, | or | and /);

const HUNDRED = "[1-7]00";
// "400 level or higher", "400- or 500-level", "300, 400, or 500 levels", "400/500 level", "300-500 levels", "300+ level", "below the 300 level".
const LEVEL_PHRASE = new RegExp(
  String.raw`\b(below )?(?:the )?${HUNDRED}(?:-level|-(?!${HUNDRED}))?(?:(?:,? (?:or|and|to) |, |\s?[-–/]\s?)${HUNDRED}(?:-level|-(?!${HUNDRED}))?)*\+?(?: ?levels?)?(?: (?:or|and) (?:above|higher))?`,
  "gi",
);

/** The first level phrase of a text and the levels it allows. Nothing above the 500 level is an undergraduate course and nothing above 700 a graduate one, so 500 and 700 leave the top open, while "500 or 600 level" stops at 600. */
function levelIn(text: string): { match: Match; phrase: string } | null {
  for (const m of text.matchAll(LEVEL_PHRASE)) {
    const phrase = m[0];
    if (!/level/i.test(phrase)) continue;
    const levels = (phrase.match(/\d00/g) ?? []).map(Number);
    const low = Math.min(...levels);
    const high = Math.max(...levels);
    const match: Match = m[1]
      ? { maxLevel: low - 100 }
      : /\+|above|higher/i.test(phrase) || high === 500 || high >= 700
        ? { minLevel: low }
        : { minLevel: low, maxLevel: high };
    return { match, phrase };
  }
  return null;
}

const EXCEPT = String.raw`(?:\s*\((?:except|excluding) (${CODE}(?:(?:, | and |, and )${CODE})*)\))?`;
const SOURCE = new RegExp(
  String.raw`^(?:the remaining credits|${RANGE}\s*credits?|at least ${NUM} credits)(?: selected| chosen)? (?:from|in) (?:any )?(?:undergraduate )?(.+?)(?: courses?)?(?: at the (\d{3})[- ]level(?: or (above|higher))?)?${EXCEPT}(?:,? and (${CODE}(?:(?:, | and |, and )${CODE})*))?\.?$`,
  "i",
);

/** "20 credits selected from computer science courses at the 300 level or above (except COMP 396) and ECSE 539". */
function parseSource(
  text: string,
  subjectsOf: (department: string) => string[],
): Rule | null {
  const m = SOURCE.exec(text);
  if (!m) return null;
  const [, low, high, atLeast, name = "", level, up, except, extra] = m;
  const subjects = new RegExp(`^${SUBJECT_LIST}$`).test(name)
    ? subjectsIn(name)
    : subjectsOf(name.toLowerCase());
  if (subjects.length === 0) return null;
  const match: Match = { subjects };
  if (level) {
    match.minLevel = Number(level);
    if (!up && Number(level) < 500) match.maxLevel = Number(level);
  }
  if (except) match.exclude = codesIn(except);
  const rule: Rule = { title: trimEnd(text), match };
  if (extra) rule.courses = codesIn(extra);
  if (low !== undefined) {
    rule.minCredits = Number(low);
    rule.maxCredits = high === undefined ? Number(low) : Number(high);
  } else if (atLeast !== undefined) rule.minCredits = Number(atLeast);
  return rule;
}

/** "One 3-credit course at the 200-level or higher from any department at McGill". */
function parseAnyCourse(text: string): Rule | null {
  const m = new RegExp(
    String.raw`^(${COUNT_WORD}) ${NUM}-credit courses? at the (\d{3})[- ]level or (?:higher|above)(?: from any department(?: at McGill)?)?\b`,
    "i",
  ).exec(text);
  if (!m) return null;
  const courses = COUNTS[(m[1] ?? "").toLowerCase()] ?? 1;
  return {
    title: trimEnd(text),
    minCredits: courses * Number(m[2]),
    match: { minLevel: Number(m[3]) },
  };
}

const MIN_LEAD = "at least|a minimum of|minimum of|minimum";
const MAX_LEAD =
  "up to|at most|a maximum of|maximum of|maximum|no more than|only";
const CLAUSE_AMOUNT = new RegExp(
  String.raw`^(?:(${MIN_LEAD}|${MAX_LEAD}|any) )?(\d+(?:\.\d+)?)(?:(?:-| or )(\d+(?:\.\d+)?))?(?: (credits?|courses?))?(?: (minimum|maximum))?(?: (\d+) courses?)?(?: |$)`,
);
const NUMBER_WORD = new RegExp(
  String.raw`\b(?:${COUNT_WORD}|nine|twelve)\b`,
  "g",
);
const NUMBERS: Record<string, number> = { ...COUNTS, nine: 9, twelve: 12 };
// Words that add nothing to a level or subject constraint. Any other word leaves the clause for a person to read.
const FILLER = new Set(
  "a additional all allowed among an any are at be can chosen come complementary completed count course courses coursework credit credits from have honours in is may must number of program selected should taken the to toward towards undergraduate used which".split(
    " ",
  ),
);
const EXCLUDING = new RegExp(
  String.raw`\s*\((?:except|excluding|other than|not including) ([^)]*)\)|,?\s+(?:except|excluding) (${CODE}(?:(?:,? and |, |,? or )${CODE})*)`,
  "gi",
);

/** One constraint: a filter such as "at least 9 of the 15 credits must be at the 400 level or higher", or a source such as "9 credits from Geography (GEOG) courses at the 300 level or above". `scoped` when the sentence narrows courses named elsewhere, so it cannot add a subject. Null when a word in it is not understood. */
function readClause(
  clause: string,
  subjectsOf: (department: string) => string[],
  scoped: boolean,
): Rule | null {
  const exclude: string[] = [];
  let unknown = false;
  let text = clause
    .replace(/^(?:one|a|any) (\d+)-credit /i, "$1 credits ")
    .replace(/\ba coherent set of /i, "")
    .replace(/\bNOTE\b:?/g, "")
    .replace(/\s*\(\d+(?: or \d+)? credits?(?: each)?\)/gi, "")
    // "ATOC (Atmospheric and Oceanic Sciences)" names the subject after its code.
    .replace(/\b([A-Z]{3}[A-Z\d]) \([A-Z][a-z][^()]*\)/g, "$1")
    .replace(/\bundergraduate(?:[- ]level)? /gi, "")
    .replace(
      /\bcourses with ([1-5]00)-level numbers\b/gi,
      "courses at the $1 level",
    )
    .replace(EXCLUDING, (_, inner = "", list = "") => {
      const codes = codesIn(inner || list);
      // "excluding ECSE 691 to ECSE 697" is a range the codes alone would miss.
      if (codes.length === 0 || /\bto\b/.test(inner || list)) unknown = true;
      exclude.push(...codes);
      return " ";
    });
  const level = levelIn(text);
  if (unknown) return null;
  if (level) text = text.replace(level.phrase, " _level_ ");
  const subjects: string[] = [];
  const subject = (list: string) => {
    subjects.push(...subjectsIn(list));
    return " _subj_ ";
  };
  text = text
    .replace(/\s+/g, " ")
    .replace(
      new RegExp(
        String.raw`(?:\b[A-Z][a-z]+(?:,? (?:and |& )?[A-Z][a-z]+)* )?\((?:subject code )?(${SUBJECT_LIST})\)`,
        "g",
      ),
      (_, list) => subject(list),
    )
    .replace(/\s+/g, " ")
    .replace(
      new RegExp(
        String.raw`\bwith (?:an? (?:prefix of )?|the subject codes? (?:of )?)(${SUBJECT_LIST})(?: prefix)?|\b(${SUBJECT_LIST}) prefix\b|\b(${SUBJECT_LIST})\b(?! ?\d{3})`,
        "g",
      ),
      (_, a, b, c) => subject(a ?? b ?? c),
    )
    .replace(/\s+/g, " ")
    .replace(
      /\b(of|in|from|credits) (?:(?:additional|other|complementary) )?((?:(?!(?:courses?|at|of|in|from|complementary)\b)[A-Za-z]+ ){0,2}(?!(?:courses?|at|of|in|from|complementary)\b)[A-Za-z]+)(?= (?:complementary )?courses?\b| (?:at )?_level_| _subj_|,|\s*$)/g,
      (all, before, name) => {
        const found = subjectsOf(name.toLowerCase());
        if (found.length === 0) return all;
        subjects.push(...found);
        return `${before} _subj_`;
      },
    );
  let s = text
    .toLowerCase()
    .replace(NUMBER_WORD, (word) => String(NUMBERS[word]))
    .replace(/[,.;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /^(?:plus |and |also |must include |select |students (?:must|should|can|may|will) (?:take|complete|select|choose) )/,
      "",
    )
    .replace(/^(?:the remaining|all other) (?=\d)/, "");
  const of =
    /\bof which\b|\bof (?:the|these) (?:\d+(?:-\d+)? )?(?:(?:complementary|course|credits?) )*credits\b/g;
  const within = scoped || of.test(s);
  // "must be from COMP courses" narrows the list, and so does "a maximum of 6 credits of SEAD courses".
  const narrows = within || /\b(?:must|should|have to|has to) be\b/.test(s);
  s = s.replace(of, " ").replace(/\s+/g, " ").trim();
  const m = CLAUSE_AMOUNT.exec(s);
  const all = m ? null : /^(?:all|any number of|any) /.exec(s);
  const rest = s
    .slice((m ?? all)?.[0].length ?? 0)
    .split(" ")
    .filter(Boolean);
  if (
    !(m || all) ||
    !rest.every((t) => FILLER.has(t) || t === "_subj_" || t === "_level_") ||
    // "6 credits at the 300 level in EAST courses selected from" names a list that follows.
    /^(?:from|of|in|at)$/.test(rest.at(-1) ?? "")
  ) {
    return null;
  }
  const match: Match = { ...level?.match };
  const amount: Amount = {};
  let max = false;
  if (m) {
    // "two 400-level ANTH courses" counts courses, "3 complementary course credits" counts credits.
    const named = rest.findIndex((t) => /^c(?:redit|ourse)s?$/.test(t));
    const [, lead = "", low = "", high, stated, after, count] = m;
    const unit =
      stated ??
      (!within &&
      rest[named]?.startsWith("course") &&
      !/^credit/.test(rest[named + 1] ?? "")
        ? "courses"
        : "credits");
    max =
      after === "maximum" ||
      (after !== "minimum" && new RegExp(`^(?:${MAX_LEAD})$`).test(lead));
    const [least, most] = unit.startsWith("course")
      ? (["minCourses", "maxCourses"] as const)
      : (["minCredits", "maxCredits"] as const);
    const top = Number(high ?? low);
    if (max) amount[most] = top;
    else {
      if (Number(low) > 0) amount[least] = Number(low);
      // A bare amount from a subject is exact, as in "9 credits from GEOG courses", but on a level it is a floor.
      const bare = !after && !new RegExp(`^(?:${MIN_LEAD})$`).test(lead);
      if (bare && subjects.length > 0) amount[most] = top;
    }
    // "6-8 credits (2 courses) from 500-level ECSE courses".
    if (count && !max) {
      amount.minCourses = Number(count);
      amount.maxCourses = Number(count);
    }
  }
  // "must be from COMP courses" or "a maximum of 6 credits of SEAD courses" narrows the group's courses instead of adding to them.
  const filter = subjects.length > 0 && (narrows || max);
  if (subjects.length === 0 ? !level || !m : filter && !m) return null;
  if (subjects.length > 0) match.subjects = unique(subjects);
  if (exclude.length > 0) match.exclude = exclude;
  return {
    title: trimEnd(clause).replace(/^\w/, (c) => c.toUpperCase()),
    ...amount,
    match,
    ...(filter && { filter: true as const }),
  };
}

// Splits "Three credits minimum must be at the 400 or 500 level and 9 credits maximum may be at the 200 level" into its constraints.
const CLAUSE_BREAK = new RegExp(
  String.raw`\s*;\s*|(?:,\s*(?:and |with |of which |while |including )?|\s+(?:and|with|of which|while|including)\s+)(?=(?:${MIN_LEAD}|${MAX_LEAD}|\d{1,2}|${COUNT_WORD}|nine|twelve)\b)|,\s*(?=(?:preferably|none in)\b)|\s+(?=drawn from at least\b)`,
  "i",
);
// "drawn from at least 3 disciplines", "Courses from at least two disciplines or departments must be included".
const SPREAD_LEAST = new RegExp(
  String.raw`^(?:courses |drawn )?from at least (\d+|${COUNT_WORD}) (?:different )?disciplines(?: or departments)?(?: must be included)?$`,
  "i",
);
// "no more than 9 credits from any one discipline", "No more than 6 credits in any given area (LLCU, GERM, HISP, ITAL, and RUSS) shall count toward the Minor Concentration (not including LLCU 210)".
const SPREAD_MOST = new RegExp(
  String.raw`^(?:no more than|a maximum of|at most) (\d+) credits (?:can be |may be )?(?:from|in) (?:any (?:one|given)|a single) (?:discipline|area)(?: \((${SUBJECT_LIST})\))?(?: shall count toward the [A-Za-z ]+?)?(?: \((?:not including|except|excluding) (${CODE}(?:(?:,? and |, )${CODE})*)\))?$`,
  "i",
);
const AS_FOLLOWS =
  /,?\s*(?:selected |chosen |distributed )?as (?:follows|described below)\s*[:.]?$/i;
// "Preferably courses at the 300 level or above" and "none in the final year of the program" advise, they do not restrict.
const ADVICE = /\b(?:preferably|normally)\b|^none in the final year/i;
const INTRO =
  /^(?:the )?(?:complementary )?courses (?:are|must be)(?: selected| chosen)?$/i;

/** The rules of a sentence, one per constraint, or null when any part of it cannot be read. `credits` is the group's, to tell a sentence about the group from one about a list inside it. */
function readStatement(
  statement: string,
  subjectsOf: (department: string) => string[],
  credits?: number,
): Rule[] | null {
  // "(of which a maximum of 21 credits may be at the 200 level)" and "(only 3 credits of which can be at the 400 level" are clauses of the sentence.
  const text = statement.replace(
    /\s*\((?=(?:of which|only|at least|including)\b)([^()]*)\)?/gi,
    ", $1",
  );
  const whole = parseSource(text, subjectsOf) ?? parseAnyCourse(text);
  if (whole) return [whole];
  // "9 credits at the 300 level or above in any of the following disciplines:; Psychology (PSYC), Biology (BIOL)" names its subjects after the colon.
  const listing =
    /^(.+?)\s+(?:selected from|(?:selected )?from the following disciplines|in any of the following disciplines):;\s*(.+)$/i.exec(
      text,
    );
  const named = listing?.[2]
    ?.split(/,\s*(?:or\s+|and\s+)?/)
    .map(
      (item) =>
        /^[A-Za-z][A-Za-z&' ]*\(([A-Z]{3}[A-Z\d])\)$/.exec(
          trimEnd(item.trim()),
        )?.[1],
    );
  if (listing && named?.every(Boolean)) {
    const rules = readStatement(
      `${listing[1]} in ${named.join(", ")}`,
      subjectsOf,
      credits,
    );
    return rules?.map((rule) => ({ ...rule, title: trimEnd(text) })) ?? null;
  }
  // A bare amount ending in a colon, such as "12-15 credits of 400/500 level courses:", belongs to the list under it.
  if (
    /:\s*$/.test(text) &&
    !/\b(?:as follows|as described below|at least|minimum|maximum|no more than|must|may|should)\b/i.test(
      text,
    )
  ) {
    return null;
  }
  // "At least 3 of these 9-12 credits" in a 24-credit group is about one list of it.
  const other = (n: number | undefined) =>
    credits !== undefined && n !== undefined && n !== credits;
  const totals = text.matchAll(
    /\bof (?:the|these) (\d+)(?:-\d+)? (?:[a-z]+ ){0,3}?credits\b/gi,
  );
  if ([...totals].some((t) => other(Number(t[1])))) return null;
  // "Of these 21 credits, at least 15 credits must be at the 300-level or above".
  const scope = /^of (?:these|the) (?!remaining)[^,]*,\s*/i.exec(text);
  // "9 credits in Computer Science selected as follows" leaves the courses to the lists below.
  const listed = /\bas (?:follows|described below)\b/i.test(text);
  const rules: Rule[] = [];
  // A spread over the group, with the credits of "18 credits from the Group B course lists below drawn from at least 3 disciplines".
  let spread: Rule | null = null;
  let lists: number | undefined;
  let topics = false;
  const body = text.slice(scope?.[0].length ?? 0);
  const breaks = [...body.matchAll(new RegExp(CLAUSE_BREAK.source, "gi"))];
  for (const [i, part] of body.split(CLAUSE_BREAK).entries()) {
    const clause = trimEnd(part.replace(AS_FOLLOWS, ""));
    if (!clause || ADVICE.test(clause) || INTRO.test(clause)) continue;
    const least = SPREAD_LEAST.exec(clause);
    const most = SPREAD_MOST.exec(clause);
    if (least || most) {
      spread ??= { title: trimEnd(text), match: {} };
      const [, n = "", subjects, except] = most ?? [];
      if (least) {
        const word = (least[1] ?? "").toLowerCase();
        spread.minSubjects = NUMBERS[word] ?? Number(word);
      }
      if (most) spread.maxCreditsPerSubject = Number(n);
      if (subjects) spread.match = { subjects: subjectsIn(subjects) };
      if (except && spread.match) spread.match.exclude = codesIn(except);
      continue;
    }
    const below =
      /^(\d+) credits from the (?:Group [A-Z] )?course lists? below$/i.exec(
        clause,
      );
    if (below) {
      lists = Number(below[1]);
      continue;
    }
    const total = bareTotal(clause);
    if (total && other(total.credits)) return null;
    if (total) continue;
    const rule = readClause(clause, subjectsOf, scope !== null || listed);
    // "and a maximum of 3 credits can be a Special Topic course": the app cannot tell those courses apart, so the sentence stays for a person to check beside what the rest of it says.
    if (!rule && /\bspecial topics?\b/i.test(clause)) {
      topics = true;
      continue;
    }
    // "36 credits in Jewish Studies selected as described below" names the program, not a subject its lists keep to.
    if (!rule || (listed && rule.match?.subjects)) return null;
    // "12 credits of MUCT courses, of which 6 credits must be at the 300 level": the level is about the courses just named.
    const source = rules.at(-1);
    if (
      /\bof which\b|\bincluding\b/i.test(
        `${breaks[i - 1]?.[0] ?? ""} ${part}`,
      ) &&
      source?.match?.subjects &&
      !source.filter &&
      !source.courses &&
      rule.match &&
      !rule.match.subjects
    ) {
      rule.match = {
        ...rule.match,
        subjects: source.match.subjects,
        ...(source.match.exclude && { exclude: source.match.exclude }),
      };
      rule.filter = true;
    }
    rules.push(rule);
  }
  // Credits from the lists below belong to those lists, unless a spread over them says the group is those lists.
  if (lists !== undefined && !spread) return null;
  if (spread) rules.push(lists ? { ...spread, minCredits: lists } : spread);
  if (topics) return rules.length > 0 ? [...rules, unparsed(statement)] : null;
  if (rules.length === 1 && rules[0]) rules[0].title = trimEnd(statement);
  return rules.length > 0 ? rules : null;
}

const REFERENCE = new RegExp(
  String.raw`^(?: and no more than (\d+) credits)?(?:,? (?:${COUNT_WORD}) courses?)?(?: in [A-Z][a-z]+(?: [A-Z][a-z]+)*)?(?: must be)?(?: selected| chosen)? (?:from|of) (?:either )?(each of )?(?:the courses in |the )?(${LIST_IDS})(?:(?: [–-])? \([^()]*\)| [–-] [A-Z][\w ]*)?(?:,? with (.+?))?\s*[:.]?$`,
  "i",
);

/** "At least 9 credits must be from Groups A and B, with at least 3 credits from each", naming lists by their headings. Null when it names a list the group does not have, or says more than this reads. */
function referenceRules(
  text: string,
  rules: Rule[],
  named: ReadonlyMap<string, Rule>,
  lists: ReadonlyMap<string, string[]>,
): Rule[] | null {
  const m = AMOUNT.exec(text);
  const ref = m && REFERENCE.exec(text.slice(m[0].length));
  if (!m || !ref) return null;
  const [, most, each, idText = "", clause] = ref;
  const ids = listIds(idText);
  const courses = ids.map((id) => lists.get(id) ?? []);
  if (courses.some((c) => c.length === 0)) return null;
  const amount = amountOf(m);
  if (most) amount.maxCredits = Number(most);
  const title = trimEnd(text);
  if (each) {
    return courses.map((list, i) => ({
      title: `${title} (${sentenceCase(ids[i] ?? "")})`,
      courses: list,
      ...amount,
    }));
  }
  const parts: Rule[] = [];
  if (clause) {
    const every = /^at least (\d+) credits (?:selected )?from each$/i.exec(
      clause,
    );
    const pairs = [
      ...clause.matchAll(
        /(?:^|,? and )at least (\d+) credits (?:selected )?from ((?:Group|List|Block) [A-Z\d])/gi,
      ),
    ];
    const read = every
      ? ids.map((id) => [every[1], id] as const)
      : pairs.map((p) => [p[1], listId(p[2] ?? "")] as const);
    if (
      read.length === 0 ||
      (!every && pairs.map((p) => p[0]).join("") !== clause)
    ) {
      return null;
    }
    for (const [credits, id] of read) {
      const list = id && ids.includes(id) ? lists.get(id) : undefined;
      if (!list) return null;
      parts.push({
        title: `At least ${credits} credits from ${sentenceCase(id ?? "")}`,
        courses: list,
        minCredits: Number(credits),
      });
    }
  }
  const union = unique(courses.flat());
  const target = ids.length === 1 ? named.get(ids[0] ?? "") : undefined;
  if (target && !clause) {
    Object.assign(target, amount);
    target.title = `${target.title}: ${title}`;
    return [];
  }
  const same = (rule: Rule) =>
    rule.minCredits === amount.minCredits &&
    rule.maxCredits === amount.maxCredits &&
    codesMatch(rule.courses ?? [], union);
  // "3 credits from Group A" above a Group A that says "3 credits from:" repeats it.
  if (!clause && rules.some(same)) return [];
  // A single list that already has an amount of its own would get two that disagree.
  if (
    ids.length === 1 &&
    rules.some((r) => codesMatch(r.courses ?? [], union))
  ) {
    return null;
  }
  // "8-11 credits (3 courses) from List A or List B" beside "3-4 credits (1 course) from List A": the List A course counts toward both, so the union's caps would refuse the courses it asks for, and the group's own total bounds them.
  const shared = rules.some(
    (rule) =>
      (rule.minCredits !== undefined || rule.minCourses !== undefined) &&
      rule.courses?.some((code) => union.includes(code)),
  );
  if (shared) {
    delete amount.maxCredits;
    delete amount.maxCourses;
  }
  return [...parts, { title, courses: union, ...amount }];
}

const NAMED_LIST =
  /^(\d+) credits (?:selected |chosen )?from the (?:[A-Z][\w,-]* )+?(?:Course )?List(?:,\s*(.+?))?\s*[:.]?$/;

/** "9 credits selected from the GSFS Course List, 3 credits of which must be at the 400 or 500 level": the one list of the group with that amount, so only its qualifier is new. Null when no single list has the amount. */
function namedListRules(
  text: string,
  rules: Rule[],
  lists: ReadonlyMap<string, string[]>,
): Rule[] | null {
  const m = NAMED_LIST.exec(text);
  if (!m) return null;
  const credits = Number(m[1]);
  const same = rules.filter(
    (rule) => rule.courses && !rule.unparsed && rule.minCredits === credits,
  );
  const [target] = same;
  if (same.length !== 1 || !target?.courses) return null;
  if (!m[2]) return [];
  const parts = partOf(
    m[2].replace(/^(\d+) credits of which /i, "of which $1 credits "),
  );
  return (
    parts &&
    partRules({ minCredits: credits, parts }, target.courses, "", lists)
  );
}

const ANY_LIST = new RegExp(
  String.raw`^(the remaining )?(\d+) credits (?:may be )?(?:selected |chosen )?from any of the (?:(${COUNT_WORD}) )?lists$`,
  "i",
);

/** "15 credits from any of the five lists": the union of the group's lists, the streams when it has them. Null when the count does not match. */
function anyListRules(text: string, rules: Rule[]): Rule[] | null {
  const m = ANY_LIST.exec(text);
  if (!m) return null;
  const streams = rules.filter((rule) => rule.option && rule.courses);
  const lists =
    streams.length > 0
      ? streams
      : rules.filter(
          (rule) =>
            rule.courses && !rule.unparsed && rule.maxCourses === undefined,
        );
  const count = COUNTS[(m[3] ?? "").toLowerCase()];
  const matches = lists.flatMap((rule) => (rule.match ? [rule.match] : []));
  if (
    lists.length === 0 ||
    (count !== undefined && lists.length !== count) ||
    matches.length > 1
  ) {
    return null;
  }
  // "The remaining 9 credits may be selected from any of the lists" is what the lists already allow.
  if (m[1] && streams.length === 0) return [];
  return [
    {
      title: text,
      courses: unique(lists.flatMap((rule) => rule.courses ?? [])),
      minCredits: Number(m[2]),
      ...(matches[0] && { match: matches[0] }),
    },
  ];
}

const HEADING_LIST =
  /^(?:at least |a minimum of )?(\d+) credits (?:must be (?:taken |selected |chosen )?)?from the ([A-Z][\w ,&-]*?) List$/i;

/** "at least 9 credits must be taken from the Basic Life Sciences List" over a heading of that name that already asks for 9: a repeat. Null when no heading has the name or its amount differs. */
function headingListRules(text: string, rules: Rule[]): Rule[] | null {
  const m = HEADING_LIST.exec(text.replace(/[,\s]+$/, ""));
  const words = (name: string) =>
    name.toLowerCase().replace(/s\b/g, "").replace(/\W+/g, " ").trim();
  const name = words(m?.[2] ?? "");
  const named = rules.filter(
    (rule) => rule.courses && words(rule.title.split(":")[0] ?? "") === name,
  );
  const [target] = named;
  return m && named.length === 1 && target?.minCredits === Number(m[1])
    ? []
    : null;
}

type NoteRule = Rule | { either: string[] };

/** Footnotes that name courses and say how they combine. */
function parseNote(text: string): NoteRule | null {
  const codes = codesIn(text);
  const s = skeleton(trimEnd(text));
  const list = "CODE(?:(?:, | or | and |, or )CODE)*";
  const taking =
    "^(?:note: )?(?:if chosen,? )?(?:students |you )?(?:may |can )?(?:take|select|choose|complete)";
  const matches = (pattern: string) => new RegExp(pattern, "i").test(s);
  if (
    matches(`${taking} (?:either|one of) ${list}(?:,? but not both)?$`) ||
    matches(`${taking} ${list},? but not both$`)
  ) {
    return { either: codes };
  }
  if (matches(`^${list} cannot both be taken(?: for program credit)?$`)) {
    return { title: trimEnd(text), maxCourses: 1, courses: codes };
  }
  if (/^must include at least one of CODE and CODE$/i.test(s)) {
    return { title: trimEnd(text), minCourses: 1, courses: codes };
  }
  return null;
}

// Sentences that set a number of credits or courses, as opposed to advice and notices.
const CONSTRAINT =
  /\b(\d+|one|two|three|four|five|six)\b[^.]*\b(credits?|courses?)\b|\b(at least|at most|no more than|maximum|minimum|remaining credits)\b/i;
// Notices that restrict nothing the app counts: the group total again, transfer credit, advice, prerequisites, registration, and what replaces a course taken before.
const NOISE = new RegExp(
  [
    String.raw`^(?:generally,|only \d+ credits will be applied to the program|\d+ credits will be applied to the program)`,
    String.raw`\btransfer credits (?:may|can) be (?:accepted|used)\b`,
    String.raw`^it is (?:strongly |highly )?(?:recommended|not advisable)\b|\b(?:are|is) (?:strongly )?(?:advised|urged) to\b|\bencourages students to\b`,
    String.raw`^students (?:are (?:therefore )?expected to take|should meet with|will register for)\b`,
    String.raw`^(?:note that )?[A-Z]{4} \d{3}\b[^.]*? is (?:a )?prerequisite\b|^prerequisites?:|\bto take an? [^,]*course[^,]*, students must have taken\b`,
    String.raw`^admission to [^.]*\brequires\b|\bCGPA\b[^.]*\b(?:required|prerequisites)\b|^although [^.]*\bprerequisites\b`,
    String.raw`^courses are offered on a rotational basis\b|^taken in two semesters\b|\bare courses sponsored by\b|^it is possible for students to transfer\b|^electives are selected\b`,
    String.raw`^\W*(?:note:\s*)?(?:students who|a student who|if a student)\b(?![^;]*\bnot count\b)[^;]*\b(?:equivalent|CEGEP)\b`,
    String.raw`^students are normally permitted to count \d+ credits from other departments\b|^in exceptional circumstances\b`,
    String.raw`^the \d+ credits required for this program must satisfy the following\b`,
  ].join("|"),
  "i",
);
const DEPARTMENT_LINE =
  /^[A-Za-z&,'-][A-Za-z&,'\s-]{1,60} \([A-Z]{3}[A-Z\d]\b[^)]*\)/;

// Schulich School of Music subjects, for "Music Electives" and "Non-Music Electives".
const MUSIC = [
  "MUCO",
  "MUCT",
  "MUEN",
  "MUGS",
  "MUGT",
  "MUHL",
  "MUIN",
  "MUIT",
  "MUJZ",
  "MUMT",
  "MUPD",
  "MUPG",
  "MUPP",
  "MURG",
  "MUSP",
  "MUSR",
  "MUTH",
];
const ELECTIVE = new RegExp(
  String.raw`^${SPAN}\s*credits? of (non-)?(?:free )?(?:([A-Za-z][A-Za-z ]*?)(?: \(([A-Z]{3}[A-Z\d])\))? )?(?:electives?|courses)(?: to be chosen freely| are taken to meet the minimum credit requirement for the degree)?(?: \(may (not )?include (?:(\d+) credits of )?courses with an? ([A-Z]{3}[A-Z\d]) prefix\))?\.?$`,
  "i",
);

/** "42 credits of Free Electives", "6 credits of Non-Music Electives" or "9 credits of Social Work (SWRK) courses", with no list to choose from. */
function parseElective(
  text: string,
  subjectsOf: (department: string) => string[],
): Rule[] | null {
  const m = ELECTIVE.exec(text);
  if (!m) return null;
  const [, low = "", , non, name, code, not, cap, capped] = m;
  const subjects = code
    ? [code]
    : !name
      ? []
      : /^music$/i.test(name)
        ? MUSIC
        : subjectsOf(name.toLowerCase());
  if (name && subjects.length === 0) return null;
  const match: Match = non
    ? { excludeSubjects: subjects }
    : subjects.length > 0
      ? { subjects }
      : {};
  if (not && capped) {
    match.excludeSubjects = [...(match.excludeSubjects ?? []), capped];
  }
  const rules: Rule[] = [
    { title: trimEnd(text), minCredits: Number(low), match },
  ];
  if (!not && capped && cap) {
    rules.push({
      title: `At most ${cap} credits of ${capped} courses`,
      maxCredits: Number(cap),
      match: { subjects: [capped] },
    });
  }
  return rules;
}

/** True for a sentence that sets credits or courses, French ones included, as opposed to advice. */
const constraint = (text: string) =>
  CONSTRAINT.test(
    text.replace(/crédit/gi, "credit").replace(/\bau moins\b/gi, "at least"),
  );

const unparsed = (text: string): Rule => ({
  title: trimEnd(text),
  unparsed: true,
});

// "subject to approval by the Student Advisor", "(approved by the Department)", "in consultation with the Program Adviser", "or with the permission of your department adviser".
const APPROVAL =
  /(?:\s*\(|,\s*|\s+|^)(?:(?:or|and|but) )?(?:(?:selected|chosen|planned|taken) )?(?:either from these lists or )?\b(?:(?:subject to|with|by|only with) (?:the )?(?:prior |signed |written )?(?:adviser and university |departmental |department )?(?:approval|permission)|in consultation with|with (?:an |the )?(?:academic )?advis[eo]r\b|(?:must be |to be |that have been |unless explicitly )?approved by|with (?:advis[eo]r|department|departmental) (?:approval|permission))[^,;()]*\)?/gi;

/** A sentence whose courses need the adviser's approval: the rest of it read as usual, any course for a stated amount, nothing for an optional extra outside the lists. */
function adviserRules(
  text: string,
  unapproved: string,
  subjectsOf: (department: string) => string[],
  credits?: number,
): Rule[] {
  const title = trimEnd(text);
  // "selected from within and/or outside the Department" allows any department.
  const rest = unapproved.replace(
    /\s*(?:selected )?(?:from )?within and\/or outside (?:of )?the department\b/i,
    "",
  );
  const read = readStatement(rest, subjectsOf, credits);
  if (read) {
    return read.map((rule) => ({
      ...rule,
      ...(read.length === 1 && { title }),
      adviser: true,
    }));
  }
  if (/\b(?:following|below)\b|\b(?:group|list) [A-Z\d]\b/i.test(text)) {
    return [unparsed(text)];
  }
  const m = AMOUNT.exec(rest);
  const { minCredits, maxCredits } = m ? amountOf(m) : {};
  // "A maximum of 9 credits may be from another department with permission": the lists still count, so the extra only reminds.
  const alternative = /^\W*or\b/i.test(rest);
  const optional =
    !minCredits || alternative || /^[^,]*\b(?:may|can)\b/i.test(rest);
  if (
    optional &&
    /\b(?:outside|another|other|elsewhere)\b|\bnon-/i.test(rest)
  ) {
    return [reminder(text)];
  }
  if (minCredits && !optional) {
    const level = levelIn(rest);
    const outside =
      /\b(?:outside|other than) (?:the )?(?:(?:school|department|faculty) of )?([a-z]+(?: [a-z]+){0,3}?)(?= must\b| selected\b| chosen\b|,|$)/i.exec(
        rest,
      );
    const excluded = outside
      ? subjectsOf((outside[1] ?? "").toLowerCase())
      : [];
    // Anything left once the amount, the level and "outside X" are read names courses the app cannot tell apart, as "from the Faculty of Science".
    // A clause after the amount that only permits, as ", a limited number of credits may be taken at other universities", restricts nothing.
    const said = rest.replace(/(?:,[^,]*\bmay\b[^,]*)+$/i, "");
    const left = [m?.[0], level?.phrase, outside?.[0]]
      .reduce<string>(
        (t, phrase) => (phrase ? t.replace(phrase, " ") : t),
        said,
      )
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(
        (word) => word && !FILLER.has(word) && !/^electives?$/.test(word),
      );
    if (left.length > 0 || (outside && excluded.length === 0)) {
      return [unparsed(text)];
    }
    const match: Match = {
      ...level?.match,
      ...(excluded.length > 0 && { excludeSubjects: excluded }),
    };
    return [{ title, minCredits, maxCredits, match, adviser: true }];
  }
  // "or any 300- or 400-level course approved by an adviser" adds to a list, so it counts nothing and reminds.
  const level = /^or any\b/i.test(rest) ? levelIn(rest) : null;
  if (level) return [{ title, match: level.match, adviser: true }];
  // "Or 3 credits at the 500 level or higher approved by the Committee" is an approved alternative to the list before it, so it reminds too.
  return [alternative ? reminder(text) : unparsed(text)];
}

/** A rule that counts nothing and reminds the student that an adviser can approve more courses. */
const reminder = (text: string): Rule => ({
  title: trimEnd(text),
  match: {},
  adviser: true,
});

/** "Other Education courses may be included with the permission of the Program Adviser": approval for courses beyond the lists, with no amount. */
const approves = (text: string) =>
  (new RegExp(APPROVAL.source, "i").test(text) ||
    /\bapprovals? (?:is |are )?required\b/i.test(text)) &&
  /\b(?:chosen|included|used|substitut\w*|counted|selected|taken|any|other)\b/i.test(
    text,
  );

/** The rules one sentence of a complementary group states: none for a notice, a reminder for an approval with no amount, its text as an unparsed rule when it cannot be read. */
export function statementRules(
  text: string,
  subjectsOf: (department: string) => string[] = () => [],
  credits?: number,
): Rule[] {
  if (NOISE.test(text)) return [];
  if (!CONSTRAINT.test(text)) return approves(text) ? [reminder(text)] : [];
  const rest = trimEnd(text.replace(APPROVAL, "")).replace(/^[\s,]+/, "");
  if (rest !== trimEnd(text)) {
    return adviserRules(text, rest, subjectsOf, credits);
  }
  return readStatement(text, subjectsOf, credits) ?? [unparsed(text)];
}

interface Context {
  subjectsOf: (department: string) => string[];
  /** A graduate page, whose prose-only headings such as a doctorate's "Thesis" become checks. */
  graduate: boolean;
}

const SET = `CODE(?:(?:,? or |, |,? and |/)CODE)+`;
const WHO = `(?:(?:students|you) )?(?:may |many |make |can )?`;
// "only one of: A or B; C or D", "at most one of A, B and C", "only one project course: A, B, or C".
const ONLY_ONE = new RegExp(
  String.raw`^${WHO}(?:(?:take|select|choose) )?(?:only|at most) one (?:of|project course)(?: the following courses)?\s*:?\s*(${SET}(?:;\s*${SET})*)$`,
  "i",
);
// "only one course in each of the following sets: A or B C or D".
const EACH = new RegExp(
  String.raw`^${WHO}(?:take|select|choose) only one course (?:in each of the following sets|from each set of the following courses)\s*:?\s*((?:CODE(?:, CODE)* (?:or|and) CODE\s*)+)$`,
  "i",
);
// "A or B, but not both", "Either A or B may be taken but not both", "Only one of A or B may be counted toward the program", and permission to take one, as "You may take one of A, B or C" or "Students can take A OR B".
const NOT_BOTH = new RegExp(
  [
    `^(?:${WHO}(?:take|select|choose) )?(?:either |one of )?(${SET}),? (?:(?:may|can) be taken,? )?but not both$`,
    `^only one of (${SET}) (?:can|may) (?:count|be counted|be included) (?:towards?|in) the program$`,
    `^(?:students|you) (?:may|can) (?:take|select|choose) (?:(?:either|one of) (${SET})|(CODE(?:, CODE)*,? or CODE))$`,
  ].join("|"),
  "i",
);
// "Students select either MUJZ 440 and MUJZ 441 or MUJZ 461D1 and MUJZ 461D2": one set or the other.
const EITHER_SETS = new RegExp(
  `^${WHO}(?:take|select|choose) either (CODE(?: and CODE)*) or (CODE(?: and CODE)*)$`,
  "i",
);

/** Sentences that let a student count only one course of each set they name, as one "not both" rule per set. Null when the sentence says more. */
function exclusiveSets(text: string): Rule[] | null {
  const title = trimEnd(text);
  const s = skeleton(title)
    .replace(/^(?:program notes|note)\s*:\s*/i, "")
    .replace(/^if chosen,?\s*/i, "");
  const codes = codesIn(title);
  const count = (chunk: string) => chunk.match(/CODE/g)?.length ?? 0;
  const take = (chunks: string[]) => {
    let at = 0;
    return chunks.map((chunk) => {
      const set = codes.slice(at, at + count(chunk));
      at += set.length;
      return unique(set);
    });
  };
  const rule = (set: string[]): Rule => ({
    title,
    maxCourses: 1,
    courses: set,
  });
  const either = EITHER_SETS.exec(s);
  if (either && /and/.test(s)) {
    const [first = [], second = []] = take([either[1] ?? "", either[2] ?? ""]);
    const pairs = first.flatMap((a) =>
      second.flatMap((b) => (a === b ? [] : [rule([a, b])])),
    );
    return pairs.length > 0 ? pairs : null;
  }
  const one = ONLY_ONE.exec(s);
  const each = EACH.exec(s);
  const chunks = one
    ? (one[1] ?? "").split(/;\s*/)
    : each
      ? ((each[1] ?? "").match(/CODE(?:, CODE)* (?:or|and) CODE/g) ?? [])
      : s.split(/;\s*/).map((chunk) => {
          const m = NOT_BOTH.exec(chunk);
          return m ? (m.slice(1).find(Boolean) ?? "") : null;
        });
  if (chunks.length === 0 || chunks.some((chunk) => chunk === null))
    return null;
  const rules = take(chunks as string[])
    .filter((set) => set.length > 1)
    .map(rule);
  return rules.length > 0 ? rules : null;
}

/** A note of several sentences whose only condition is a set of courses that cannot both count, as "Students may take either COMP 202 or COMP 204, but not both. Students who have taken the equivalent...". */
function sentenceSets(note: string): Rule[] | null {
  const parts = sentences(note);
  const sets = parts.map(exclusiveSets);
  return parts.length > 1 &&
    sets.some(Boolean) &&
    parts.every((p, i) => sets[i] || NOISE.test(p) || !constraint(p))
    ? sets.flatMap((set) => set ?? [])
    : null;
}

function noteRules(notes: string[]): Rule[] {
  return notes.flatMap((note) => {
    const sets = exclusiveSets(note) ?? sentenceSets(note);
    if (sets) return sets;
    const parsed = parseNote(note);
    if (parsed && "either" in parsed) {
      return [{ title: trimEnd(note), maxCourses: 1, courses: parsed.either }];
    }
    if (parsed) return [parsed];
    return CONSTRAINT.test(note) && !NOISE.test(note) ? [unparsed(note)] : [];
  });
}

const tablesIn = (section: Section): Table[] =>
  events(section).filter((e) => e.kind === "table");
const textsIn = (section: Section) =>
  events(section).flatMap((e) => (e.kind === "text" ? [e.text] : []));
const unique = (codes: string[]) => [...new Set(codes)];
const codesMatch = (a: string[], b: string[]) =>
  a.length === b.length && a.every((code) => b.includes(code));
const sentenceCase = (id: string) =>
  id
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/ (.)$/, (c) => c.toUpperCase());
const coursesOf = (tables: Table[]) =>
  unique(tables.flatMap((t) => t.rows.flatMap((row) => row.codes)));

/** One rule per qualifier of a list statement, over the courses of the list it names, or null when a qualifier names none of them. They come first so the engine fills the stricter rule before the list's own. */
function partRules(
  found: ListAmount,
  courses: string[],
  label: string,
  lists: ReadonlyMap<string, string[]>,
): Rule[] | null {
  const rules: Rule[] = [];
  for (const part of found.parts ?? []) {
    const named = partCourses(part, courses, lists);
    if (named.length === 0) return null;
    // "of Introductory Courses at the 200 level" over a list of 200-level courses asks nothing more.
    if (
      named.length === courses.length &&
      part.maxCredits === undefined &&
      part.minCredits <= (found.minCredits ?? 0)
    ) {
      continue;
    }
    rules.push({
      title: [label, part.title].filter(Boolean).join(": "),
      courses: named,
      minCredits: part.minCredits,
      ...(part.maxCredits !== undefined && { maxCredits: part.maxCredits }),
    });
  }
  return rules;
}

/** A level rule or a filter from a nested heading as a rule over that heading's courses it matches, so it does not reach the group's other lists. */
function scoped(rule: Rule, scope: Section): Rule {
  const { match, title, filter, ...amount } = rule;
  if (
    !match ||
    rule.courses ||
    (match.subjects && !filter) ||
    match.excludeSubjects ||
    (!filter && match.minLevel === undefined && match.maxLevel === undefined) ||
    rule.adviser ||
    rule.maxCreditsPerSubject !== undefined ||
    rule.minSubjects !== undefined
  ) {
    return rule;
  }
  const courses = coursesOf(tablesIn(scope)).filter((code) =>
    ruleMatches({ title, match }, code),
  );
  return courses.length > 0 ? { title, ...amount, courses } : unparsed(title);
}

/** The rules of a complementary group, from its tables and the sentences around them. */
function rulesOf(section: Section, ctx: Context): Rule[] {
  const rules: Rule[] = [];
  const named = new Map<string, Rule>();
  // A sentence under a nested heading with credits of its own is about that heading's lists. `own` is the heading it sits under.
  const narrative: { text: string; scope?: Section; own: Section }[] = [];
  const tell = (texts: string[], sec: Section) => {
    const scope = sec !== section && sec.min !== undefined ? sec : undefined;
    narrative.push(...texts.map((text) => ({ text, scope, own: sec })));
  };
  let previous: string[] = [];
  // The courses under each heading such as "Group A", for statements that name them.
  const lists = new Map<string, string[]>();
  // A list's courses leave out those of a list labelled inside it, as "Group D" under "Group C".
  const own = (sec: Section): Table[] =>
    sec.items.flatMap((item) =>
      item.kind === "table"
        ? [item]
        : item.kind === "section" && !listId(item.title)
          ? own(item)
          : [],
    );
  const label = (sec: Section) => {
    const id = listId(sec.title);
    if (id) lists.set(id, coursesOf(own(sec)));
    for (const item of sec.items) if (item.kind === "section") label(item);
  };
  label(section);

  /** "3-6 credits from the following:" above several labelled lists is one rule over all of them. */
  const union = (statement: string, children: Section[], label: string) => {
    const tables = children.flatMap(tablesIn);
    const found = listAmount(statement);
    const parts = found && partRules(found, coursesOf(tables), label, lists);
    const before = (c: Section) => {
      const all = events(c);
      const at = all.findIndex((e) => e.kind === "table");
      return at < 0 ? all : all.slice(0, at);
    };
    if (
      !found ||
      !parts ||
      tables.length < 2 ||
      children.some(
        (c) =>
          textsIn(c).some((t) => listAmount(t)) ||
          // A condition before a heading's first list describes a source the union would miss.
          before(c).some((e) => e.kind === "text" && constraint(e.text)),
      )
    ) {
      return false;
    }
    const { union: _, parts: __, ...amount } = found;
    rules.push(...parts, {
      title: [label, trimEnd(statement)].filter(Boolean).join(": "),
      courses: coursesOf(tables),
      ...amount,
    });
    for (const child of children) tell(textsIn(child), child);
    for (const table of tables) rules.push(...noteRules(table.notes));
    return true;
  };

  const visit = (sec: Section, label: string) => {
    let pending: string[] = [];
    // A statement above several tables with no statement of their own is about all of them.
    let run: Rule | null = null;
    // The last list and its rule, for a line after it that opens the list further.
    let listed: { table: Table; rule: Rule } | null = null;
    // "27 credits from one of the following two streams" beside other lists: each stream's rules join the group under its name.
    const streams = streamsOf(sec);
    const options =
      streams && streamOptions(streams.options, streams.credits, ctx);
    for (const [i, item] of sec.items.entries()) {
      if (options && item === streams.statement) continue;
      if (
        options &&
        item.kind === "section" &&
        streams.options.includes(item)
      ) {
        if (item === streams.options[0]) {
          tell(pending, sec);
          pending = [];
          run = null;
          rules.push(...options);
        }
        continue;
      }
      if (item.kind === "text") {
        const opens =
          listed && sec.items[i - 1] === listed.table
            ? widening(item.text, ctx.subjectsOf)
            : null;
        if (opens && listed && !listed.rule.match) listed.rule.match = opens;
        else pending.push(item.text);
      } else if (item.kind === "section") {
        // Everything after a heading belongs to it or to a later heading. "24 credits of courses in East Asian Literature" under that heading points at its lists.
        const titled = (t: string) =>
          sec.title && t.includes(sec.title) && !listAmount(t)
            ? t.replace(sec.title, "the following")
            : t;
        const statement = pending.map(titled).findLast((t) => listAmount(t));
        const children = sec.items.slice(i).filter((c) => c.kind === "section");
        if (statement && union(statement, children, label)) {
          tell(
            pending.filter((t) => titled(t) !== statement),
            sec,
          );
          return;
        }
        tell(pending, sec);
        pending = [];
        run = null;
        visit(item, item.title);
      } else {
        const courses = coursesOf([item]);
        const widen = widening(pending.at(-1) ?? "", ctx.subjectsOf);
        if (widen) {
          pending.pop();
          run = null;
        }
        const last = pending.at(-1);
        // "3 credits of Theory courses from the complementary list or with the permission of your department adviser" over its table: the list's amount, with a reminder.
        const approved =
          last !== undefined && last.replace(APPROVAL, "") !== last
            ? trimEnd(last.replace(APPROVAL, ""))
            : undefined;
        const own = last !== undefined && listAmount(last, true);
        const adjacent =
          own || (approved !== undefined && listAmount(approved, true));
        const reminds = !own && Boolean(adjacent);
        let bound = adjacent ? last : pending.findLast((p) => listAmount(p));
        let found = adjacent || (bound ? listAmount(bound) : null);
        const parts = found && partRules(found, courses, label, lists);
        if (!parts) {
          bound = undefined;
          found = null;
        }
        const name = pending.findLast(
          (p) =>
            p.length <= 60 &&
            !/[.:;]/.test(p) &&
            !/^or$/i.test(p) &&
            // "MUEN prefix - maximum 4 credits" is a cap, while "300-level complementary courses" names the list.
            !/\bcr[eé]dits?\b|\b(?:maximum|minimum|at least|no more than)\b/i.test(
              p,
            ),
        );
        tell(
          pending.filter((p) => p !== bound && p !== name),
          sec,
        );
        // An unread condition between two lists means the second is not part of the first one's run.
        if (pending.some((p) => p !== bound && constraint(p))) run = null;
        pending = [];
        if (courses.length === 0) continue;
        const notes = noteRules(item.notes);
        if (run && !found) {
          run.courses = unique([...(run.courses ?? []), ...courses]);
          previous = courses;
          listed = { table: item, rule: run };
          rules.push(...notes);
          continue;
        }
        const { union, parts: _, ...amount } = found ?? {};
        const above = rules.flatMap((rule) => rule.courses ?? []);
        const rule: Rule = {
          title:
            [name ?? label, bound && trimEnd(bound)]
              .filter(Boolean)
              .join(": ") || section.title,
          courses: unique([
            ...(union === "above" ? above : union ? previous : []),
            ...courses,
          ]),
          ...amount,
          ...(widen && { match: widen }),
          ...(reminds && bound === last && { adviser: true as const }),
        };
        listed = { table: item, rule };
        rules.push(...(parts ?? []), rule, ...notes);
        if (found) run = rule;
        const id = listId(label);
        if (id && !found) named.set(id, rule);
        previous = courses;
      }
    }
    tell(pending, sec);
  };
  visit(section, "");

  const statements: typeof narrative = [];
  for (const { text: line, scope, own } of narrative) {
    // "You may take only one of: A or B; C or D" before the splitter cuts it at the colon.
    const sets = exclusiveSets(line) ?? sentenceSets(line);
    if (sets) {
      rules.push(...sets);
      continue;
    }
    for (const text of sentences(line)) {
      const last = statements.at(-1);
      if (DEPARTMENT_LINE.test(text) && last) last.text += `; ${text}`;
      else statements.push({ text, scope, own });
    }
  }
  // A filter alone under a heading with no list, as "A maximum of 12 credits of ANTH courses" under "200 Level", is a source of its own.
  const alone = ({ filter: _, ...rule }: Rule, own: Section): Rule =>
    own !== section && tablesIn(own).length === 0
      ? rule
      : { ...rule, filter: true };
  for (const { text, scope, own } of statements) {
    const sets = exclusiveSets(text);
    if (sets) {
      rules.push(...sets);
      continue;
    }
    if (
      bareTotal(text) ||
      NOISE.test(text) ||
      (!constraint(text) && !approves(text))
    ) {
      continue;
    }
    const referred =
      referenceRules(text, rules, named, lists) ??
      namedListRules(trimEnd(text), rules, lists) ??
      anyListRules(trimEnd(text), rules) ??
      headingListRules(trimEnd(text), rules);
    if (referred) {
      rules.push(...referred);
      continue;
    }
    const electives = parseElective(text, ctx.subjectsOf);
    if (electives) {
      rules.push(...electives);
      continue;
    }
    // The sentence parser reads English, so a French condition stays for a person to check.
    const read =
      CONSTRAINT.test(text) || approves(text)
        ? statementRules(text, ctx.subjectsOf, scope?.min ?? section.min)
        : [unparsed(text)];
    rules.push(
      ...read.map((rule) =>
        scope ? scoped(rule, scope) : rule.filter ? alone(rule, own) : rule,
      ),
    );
  }
  // A footnote repeated under each table says the same thing once.
  const seen = new Set<string>();
  const distinct = rules.filter((rule) => {
    const key = JSON.stringify(rule);
    return !seen.has(key) && Boolean(seen.add(key));
  });
  rules.splice(0, rules.length, ...distinct);
  // A filter with no list to narrow would stand for the whole group.
  const listed = rules.some(
    (rule) =>
      !rule.unparsed && !rule.filter && (rule.courses || rule.match?.subjects),
  );
  if (listed) return rules;
  return rules.map((rule) => {
    if (rule.filter) return unparsed(rule.title);
    // With no list a reminder is the group's source, so it keeps the level it names, as "At the 500 level or higher, and selected in consultation with the academic adviser".
    const level = levelIn(rule.title)?.match;
    return level && rule.adviser && JSON.stringify(rule.match) === "{}"
      ? { ...rule, match: level }
      : rule;
  });
}

const FOUNDATION = /year 0|foundation/i;

function dedupe(items: RequiredItem[]): RequiredItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = typeof item === "string" ? item : item.oneOf.join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function requiredGroup(section: Section): RequiredGroup | null {
  const items: RequiredItem[] = [];
  const notes: string[] = [];
  const rows: Row[] = [];
  let intro: string[] = [];
  for (const event of events(section)) {
    if (event.kind === "text") intro.push(event.text);
    if (event.kind === "heading") intro = [];
    if (event.kind !== "table") continue;
    rows.push(...event.rows);
    const codes = event.rows.flatMap((row) => row.codes);
    const choices = intro.flatMap(
      (t, i) => listAmount(t, i === intro.length - 1) ?? [],
    );
    // "Select 3 credits of the following:" over 3-credit courses is one of them, and so is any amount over a single course.
    const single = (c: ListAmount) =>
      c.maxCourses === 1 ||
      (codes.length === 1 && (c.minCredits ?? 0) > 0) ||
      (c.minCredits !== undefined &&
        c.minCredits === c.maxCredits &&
        !c.parts &&
        event.rows.every((row) => row.credits === c.minCredits));
    // "6 credits from the following" under a Required heading is a choice, so the list is not required, and so is a choice it cannot read, as "Students select one course titled ...".
    const unread = intro.some(
      (t) =>
        new RegExp(
          String.raw`\b(?:select|choose) (?:${COUNT_WORD}|\d+)\b`,
          "i",
        ).test(t) &&
        constraint(t) &&
        !listAmount(t) &&
        !bareTotal(t),
    );
    if (unread || !choices.every(single)) return null;
    if (choices.length > 0 && codes.length > 1) {
      items.push({ oneOf: [...new Set(codes)] });
    } else {
      for (const row of event.rows) {
        const last = items.at(-1);
        if (row.or && last) {
          items.pop();
          const options = typeof last === "string" ? [last] : last.oneOf;
          items.push({ oneOf: [...options, ...row.codes] });
        } else items.push(...row.codes);
      }
    }
    for (const note of event.notes) {
      const parsed = parseNote(note);
      const either = parsed && "either" in parsed ? parsed.either : [];
      const at = items.indexOf(either[0] ?? "");
      if (
        either.length > 1 &&
        at >= 0 &&
        either.every((c) => items.includes(c))
      ) {
        items.splice(at, 0, { oneOf: either });
        for (const c of either) items.splice(items.indexOf(c), 1);
      } else notes.push(note);
    }
    intro = [];
  }
  if (items.length === 0) return null;
  const parts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    row.codes.forEach((code, i) => {
      const part = parts.get(code) ?? new Map<string, number>();
      part.set(row.printed[i] ?? code, row.credits);
      parts.set(code, part);
    });
  }
  // A course printed whole counts once, its D1 and D2 parts add up, and N1 and N2 are the same course spread over other terms.
  const creditsOf = (code: string) => {
    const printed = parts.get(code) ?? new Map<string, number>();
    const whole = printed.get(code);
    if (whole !== undefined) return whole;
    const sums = new Map<string, number>();
    for (const [part, n] of printed) {
      const letter = part.slice(-2, -1);
      sums.set(letter, (sums.get(letter) ?? 0) + n);
    }
    return Math.max(0, ...sums.values());
  };
  const courses = dedupe(items);
  // One course of each "one of" counts.
  const listed = courses.reduce(
    (sum, item) =>
      sum +
      (typeof item === "string"
        ? creditsOf(item)
        : Math.min(...item.oneOf.map(creditsOf))),
    0,
  );
  const group: RequiredGroup = {
    title: section.title,
    kind: "required",
    credits: section.max ?? listed,
    courses,
  };
  LISTED.set(group, listed);
  if (FOUNDATION.test(section.title)) group.foundation = true;
  if (notes.length > 0) group.note = notes.join(" ");
  if (section.min !== undefined && section.min < group.credits) {
    LOWER.set(group, section.min);
  }
  return group;
}

/** The lower bound of a required heading's range, as "U1 Required Courses (20-24 credits)", for pages whose total counts it. A complementary range keeps its lower bound, since that is when the group is done. */
const LOWER = new WeakMap<RequiredGroup, number>();
/** The credits a required group's courses add up to, which a heading can state more than. */
const LISTED = new WeakMap<RequiredGroup, number>();

/** "AND 3 credits Natural Science complementary courses" after a required list, with subject lines such as "Physics (PHYS)", or "must also successfully complete 18 credits as follows:" with lines the sentence parser reads. */
function additionalCredits(
  section: Section,
  ctx: Context,
): ComplementaryGroup | null {
  const all = events(section);
  const after = all
    .slice(all.findLastIndex((e) => e.kind === "table") + 1)
    .flatMap((e) => (e.kind === "text" ? [e.text] : []));
  const also = after.findIndex((t) =>
    /\bmust (?:also )?(?:successfully )?complete \d+ credits as follows:?$/i.test(
      t,
    ),
  );
  if (also >= 0) {
    const [statement = "", ...lines] = after.slice(also);
    const rules = lines.flatMap((line) => statementRules(line, ctx.subjectsOf));
    if (
      lines.length === 0 ||
      rules.length === 0 ||
      rules.some((r) => r.unparsed)
    )
      return null;
    const group: ComplementaryGroup = {
      title: `${section.title}, extra credits`,
      kind: "complementary",
      credits: Number(/(\d+) credits as follows/i.exec(statement)?.[1]),
      rules,
    };
    if (FOUNDATION.test(section.title)) group.foundation = true;
    return group;
  }
  const at = after.findIndex((t) => /^(?:and|plus) \d/i.test(t));
  const [statement, ...lines] = after.slice(at);
  const credits = /^(?:and|plus) (\d+(?:\.\d+)?) credits/i.exec(
    statement ?? "",
  )?.[1];
  if (at < 0 || !statement || !credits) return null;
  const subjects = lines.flatMap((line) => {
    const list = new RegExp(String.raw`^[^()]+ \((${SUBJECT_LIST})\)$`).exec(
      line,
    );
    return list ? subjectsIn(list[1] ?? "") : [];
  });
  const rule: Rule =
    subjects.length > 0 && subjects.length >= lines.length
      ? {
          title: trimEnd(statement),
          minCredits: Number(credits),
          match: { subjects },
        }
      : unparsed([statement, ...lines].join("; "));
  const named = /credits (.+?) complementary courses/i.exec(statement)?.[1];
  const group: ComplementaryGroup = {
    title: named ? `${named} complementary` : `${section.title}, extra credits`,
    kind: "complementary",
    credits: Number(credits),
    rules: [rule],
  };
  if (FOUNDATION.test(section.title)) group.foundation = true;
  return group;
}

const hasOwnCredits = (section: Section) => {
  const first = section.items.find((i) => i.kind === "text");
  return (
    section.min !== undefined ||
    (first?.kind === "text" &&
      (bareTotal(first.text) !== null || STREAMS.test(first.text)))
  );
};

const STREAMS = new RegExp(
  String.raw`^(?:(?:honours )?students must complete )?${SPAN}\s*credits? (?:from|in) one of (?:the )?(?:following )?(?:(${COUNT_WORD}) )?(?:(?:specialized )?(streams|lists|specializations|options)(?: set out below| listed below)?(?::\s*([^.;:]+?))?|((?:Stream|List|Option) [A-Z\d](?: or (?:Stream|List|Option) [A-Z\d])+))\s*[:.]?$`,
  "i",
);

/** The headings a statement such as "15-17 credits from one of the following streams:" chooses between, or null when they are not clear. */
function streamsOf(section: Section) {
  const statement = section.items.find(
    (item): item is Text => item.kind === "text" && STREAMS.test(item.text),
  );
  const m = statement && STREAMS.exec(statement.text);
  const at = statement ? section.items.indexOf(statement) : -1;
  const first = section.items.findIndex((item) => item.kind === "section");
  if (!statement || !m || first < at) return null;
  const [, low, , count, kind = "", named, ids] = m;
  const children = section.items.filter((i) => i.kind === "section");
  const titled = (name: string) =>
    children.filter((c) =>
      c.title.toLowerCase().startsWith(name.toLowerCase()),
    );
  const names = named?.split(/, or |, | or /) ?? ids?.split(" or ");
  const singular = kind.toLowerCase().replace(/s$/, "");
  const kindOf = children.filter((c) =>
    c.title.toLowerCase().includes(singular),
  );
  const options = names
    ? names.flatMap((name) => (titled(name).length === 1 ? titled(name) : []))
    : kindOf.length > 1
      ? kindOf
      : children;
  const wanted = names?.length ?? COUNTS[(count ?? "").toLowerCase()];
  // A heading between two streams that is not one of them, as "OR Global Governance" after Stream 2, may belong to either.
  const place = (s: Section | undefined) => (s ? section.items.indexOf(s) : -1);
  const between = children.some(
    (c) =>
      !options.includes(c) &&
      place(c) > place(options[0]) &&
      place(c) < place(options.at(-1)),
  );
  if (
    options.length < 2 ||
    between ||
    (wanted !== undefined && options.length !== wanted)
  ) {
    return null;
  }
  return { statement, credits: Number(low), options };
}

/** A stream as one rule, when it is one list with at most one amount of its own. */
function streamRule(stream: Section, credits: number): Rule | null {
  const tables = tablesIn(stream);
  const courses = coursesOf(tables);
  const statements = textsIn(stream).filter(
    (t) => constraint(t) || listAmount(t),
  );
  const [statement] = statements;
  const found = statement === undefined ? {} : listAmount(statement, true);
  if (
    courses.length === 0 ||
    statements.length > 1 ||
    !found ||
    found.parts ||
    found.union ||
    tables.some((t) => noteRules(t.notes).length > 0)
  ) {
    return null;
  }
  return {
    title: stream.title,
    courses,
    ...(statement === undefined
      ? { minCredits: stream.min ?? credits }
      : found),
  };
}

/** The section without a last line that points at lists after it, as "36 credits selected from any combination of the following lists:" ending a stream, since those lists are not in it. */
function withoutPointer(section: Section): Section {
  const last = section.items.at(-1);
  if (last?.kind === "section") {
    return {
      ...section,
      items: [...section.items.slice(0, -1), withoutPointer(last)],
    };
  }
  return last?.kind === "text" && /\bfollowing\b[^.]*:$/i.test(last.text)
    ? { ...section, items: section.items.slice(0, -1) }
    : section;
}

/** Each stream's rules, named by its title: one rule for a single list, else what its lists and sentences say. Null when a stream says nothing. */
function streamOptions(
  streams: Section[],
  credits: number,
  ctx: Context,
): Rule[] | null {
  const rules: Rule[] = [];
  for (const whole of streams) {
    const stream = withoutPointer(whole);
    const widened = textsIn(stream).some((t) => widening(t, ctx.subjectsOf));
    const one = widened ? null : streamRule(stream, credits);
    const own = one ? [one] : rulesOf(stream, ctx);
    if (own.length === 0) return null;
    // A single list read beside a subject line or a footnote still owes the stream's credits, as streamRule's plain list does. A sentence left as text may give it another amount.
    const lists = own.filter(
      (rule) =>
        !rule.filter &&
        rule.maxCourses === undefined &&
        (rule.courses || rule.match?.subjects),
    );
    const [list] = lists;
    if (
      list &&
      lists.length === 1 &&
      !own.some((rule) => rule.unparsed) &&
      list.minCredits === undefined &&
      list.maxCredits === undefined &&
      list.minCourses === undefined
    ) {
      list.minCredits = stream.min ?? credits;
    }
    rules.push(...own.map((rule) => ({ ...rule, option: whole.title })));
  }
  return rules;
}

/** "12 credits from one of the following streams" as a group that counts one stream, and whatever else the section asks as groups of its own. */
function streamGroups(section: Section, ctx: Context): Group[] | null {
  const streams = streamsOf(section);
  if (!streams) return null;
  const rules = streamOptions(streams.options, streams.credits, ctx);
  const rest = section.items.filter(
    (item) =>
      item !== streams.statement &&
      !(item.kind === "section" && streams.options.includes(item)),
  );
  // Lines beside the streams go with the lists they introduce, else they are notes, and a note that asks for more would be lost.
  const tables = rest.some((item) => item.kind === "table");
  const notes = tables
    ? []
    : rest.flatMap((item) =>
        item.kind === "text" && constraint(item.text) ? [item.text] : [],
      );
  const widening = notes.every((t) => /approv|permission/i.test(t));
  if (!rules || !widening) return null;
  const group: ComplementaryGroup = {
    title: section.title,
    kind: "complementary",
    credits: streams.credits,
    rules,
  };
  if (notes.length > 0) group.note = notes.join(" ");
  if (FOUNDATION.test(section.title)) group.foundation = true;
  const left =
    section.min === undefined ? undefined : section.min - streams.credits;
  const others = rest.some((item) => item.kind !== "text")
    ? complementaryGroups(
        {
          ...section,
          items: tables ? rest : rest.filter((item) => item.kind !== "text"),
          min: left && left > 0 ? left : undefined,
          max: left && left > 0 ? left : undefined,
        },
        ctx,
      )
    : [];
  const before = section.items.findIndex(
    (item) => item.kind === "section" && !streams.options.includes(item),
  );
  const after = section.items.indexOf(streams.options[0] as Section);
  return before >= 0 && before < after
    ? [...others, group]
    : [group, ...others];
}

const leadingCredits = (section: Section) => {
  const first = section.items.find((i) => i.kind === "text");
  const m = first?.kind === "text" ? AMOUNT.exec(first.text) : null;
  return m && !m[1] ? Number(m[2]) : undefined;
};

function complementaryGroups(section: Section, ctx: Context): Group[] {
  const streams = streamGroups(section, ctx);
  if (streams) return streams;
  // Streams it could not read stay one group, since splitting them would ask for every stream.
  const choosing = section.items.some(
    (i) => i.kind === "text" && STREAMS.test(i.text),
  );
  const children = choosing
    ? []
    : section.items.filter((i) => i.kind === "section");
  const own = section.items.filter((i) => i.kind !== "section");
  const firstText = own.find((i) => i.kind === "text");
  const whole =
    section.min ?? (firstText ? bareTotal(firstText.text)?.credits : undefined);
  const shares = children.map(leadingCredits);
  // "9 credits" over "Group A: 3 credits from" and "Group B: 6 credits from" is two groups.
  if (
    whole !== undefined &&
    children.length > 1 &&
    own.every((i) => i.kind === "text") &&
    shares.every((n) => n !== undefined) &&
    shares.reduce((sum, n) => sum + (n ?? 0), 0) === whole
  ) {
    return children.flatMap((child) =>
      groupsOf(
        {
          ...child,
          title: child.title.startsWith(section.title)
            ? child.title
            : `${section.title} ${child.title}`,
        },
        ctx,
      ),
    );
  }
  if (
    children.length > 0 &&
    own.every((i) => i.kind === "text") &&
    children.every((c) => hasOwnCredits(c) || events(c).length === 0)
  ) {
    return children.flatMap((child) => groupsOf(child, ctx));
  }
  const text = events(section).flatMap((e) =>
    e.kind === "text" ? [e.text] : [],
  );
  const total = text[0] ? bareTotal(text[0]) : null;
  const stated = text
    .map((t) => AMOUNT.exec(t))
    .find((m) => m && !m[1] && Number(m[2]) > 0);
  const credits = section.min ?? total?.credits ?? Number(stated?.[2]);
  const read = rulesOf(section, ctx);
  const [lone] = read;
  const leveled =
    lone?.match?.minLevel !== undefined || lone?.match?.maxLevel !== undefined;
  // Reminders count no course, so one alone at a level is the group's source, as "At the 500 level or higher, and selected in consultation with the academic adviser" under "Elective Courses (6 credits)", and any other is for a person to check.
  const rules =
    read.length > 0 && read.every(isReminder)
      ? read.length === 1 && lone && leveled && credits
        ? [{ ...lone, minCredits: credits }]
        : read.map((rule) => unparsed(rule.title))
      : read;
  // A condition over the whole program, as "a maximum of 34 credits at the 200 level ... in this program", with no credits of its own: a group that only asks a person to check it.
  if (
    !credits &&
    /\brequirements?\b/i.test(section.title) &&
    rules.length > 0 &&
    rules.every((rule) => rule.unparsed)
  ) {
    return [{ title: section.title, kind: "complementary", credits: 0, rules }];
  }
  // A heading with no credits and no list that asks for a thesis, a requirement or courses described in prose, as every doctorate's "Thesis": a group a person checks.
  const [prose] = textsIn(section);
  if (
    ctx.graduate &&
    !credits &&
    prose &&
    tablesIn(section).length === 0 &&
    CHECKED.test(section.title)
  ) {
    const checks =
      rules.length > 0
        ? rules.map((rule) => (rule.unparsed ? rule : unparsed(rule.title)))
        : [unparsed(sentences(prose)[0] ?? prose)];
    return [
      {
        title: section.title,
        kind: "complementary",
        credits: 0,
        rules: checks,
      },
    ];
  }
  if (!credits && section.min === undefined) {
    const asks = creditless(section, rules);
    if (asks) return [asks];
  }
  if (!credits) return [];
  const group: ComplementaryGroup = {
    title: section.title,
    kind: "complementary",
    credits,
    rules: rules.length > 0 ? rules : [unparsed(section.title)],
  };
  // "Thesis Courses (24-33 credits)" counts courses up to its top, unless only a person can check it.
  if (
    section.max !== undefined &&
    section.max > credits &&
    credits === section.min &&
    group.rules.some((rule) => !rule.unparsed && !isReminder(rule))
  ) {
    group.maxCredits = section.max;
  }
  if (total?.minCourses) group.minCourses = total.minCourses;
  if (FOUNDATION.test(section.title)) group.foundation = true;
  return [group];
}

// Sentences a check group leaves out, since they permit, advise, or apply to some students only.
const ASIDE =
  /\b(?:may|can|encouraged|urged|should|advised?|consult|prerequisites?|applicants?|not required|no longer required)\b|\bup to an additional\b|^whenever\b|\b(?:students?|candidates?) (?:who|wishing|following|interested|planning|considering|for whom)\b/i;
const DEMANDS = /\bmust\b|\brequired\b/i;

/** A section with no credits that still asks for something: a group of what its lists ask, as "Two courses chosen from the following", else a group a person checks, one rule per sentence that demands. Null when its lists come with a permission, as "students may take up to an additional 3 credits of thesis courses", or nothing demands. */
function creditless(
  section: Section,
  rules: Rule[],
): ComplementaryGroup | null {
  const all = events(section);
  const first = all.findIndex((e) => e.kind === "table");
  const intro = all
    .slice(0, first)
    .flatMap((e) => (e.kind === "text" ? sentences(e.text) : []));
  if (first >= 0 && intro.some((t) => ASIDE.test(t))) return null;
  const rows = tablesIn(section).flatMap((table) => table.rows);
  const credit = (code: string) =>
    Math.min(
      ...rows.flatMap((row) =>
        row.credits > 0 && row.codes.includes(code) ? [row.credits] : [],
      ),
    );
  const lists = rules.filter(
    (rule) =>
      rule.courses && !rule.unparsed && (rule.minCredits || rule.minCourses),
  );
  const apart = lists.every((a, i) =>
    lists
      .slice(i + 1)
      .every((b) => !b.courses?.some((code) => a.courses?.includes(code))),
  );
  // "One of the following courses" asks for the least credits a course of the list has, and "0-6 credits from" asks nothing.
  const credits = lists.reduce(
    (sum, rule) =>
      sum +
      (rule.minCredits ??
        (rule.minCourses ?? 0) * Math.min(...(rule.courses ?? []).map(credit))),
    0,
  );
  if (first >= 0 && apart && credits > 0 && Number.isFinite(credits)) {
    return { title: section.title, kind: "complementary", credits, rules };
  }
  const checks = textsIn(section)
    .flatMap(sentences)
    .filter(
      (t) =>
        (DEMANDS.test(t) ||
          (first >= 0 &&
            constraint(t) &&
            !/^0\s*(?:[-–]|or|to)\s*\d/.test(t))) &&
        !ASIDE.test(t) &&
        !NOISE.test(t),
    );
  return checks.length > 0
    ? {
        title: section.title,
        kind: "complementary",
        credits: 0,
        rules: [...new Set(checks)].map(unparsed),
      }
    : null;
}

const SEPARATE = /complementary|elective|compl[ée]mentaires?/i;
const ALTERNATIVE_NOTE =
  "The catalogue also lists an alternative set of required courses.";
const CHECKED = /^thesis$|\brequirements?\b|complementary|elective/i;
const ALTERNATIVE = /^alternative|^option\b/i;

function groupsOf(section: Section, ctx: Context): Group[] {
  const title = section.title;
  if (/prerequisite/i.test(title) && !FOUNDATION.test(title)) return [];
  // The Specialization a B.Sc.(Ag.Env.Sc.) major names is a program of its own, outside this one's credits.
  if (/^specializations?$/i.test(title)) return [];
  if (!/\brequired\b|\bobligatoires?\b/i.test(title) || SEPARATE.test(title)) {
    return complementaryGroups(section, ctx);
  }
  // What follows "OR" is another way to meet the requirement, and a Complementary heading under a Required one starts its own group.
  const cut = section.items.findIndex(
    (item) => item.kind === "text" && /^or$/i.test(item.text),
  );
  const items = cut < 0 ? section.items : section.items.slice(0, cut);
  const split = items.findIndex(
    (item) => item.kind === "section" && SEPARATE.test(item.title),
  );
  const head = split < 0 ? items : items.slice(0, split);
  const nested = items[split];
  const own: Section = {
    ...section,
    items: head.filter(
      (item) => !(item.kind === "section" && ALTERNATIVE.test(item.title)),
    ),
  };
  const required = requiredGroup(own);
  if (!required) return complementaryGroups(section, ctx);
  if (cut >= 0 || own.items.length < head.length) {
    required.note = [required.note, ALTERNATIVE_NOTE].filter(Boolean).join(" ");
  }
  const extra = additionalCredits(own, ctx);
  if (extra) required.credits -= extra.credits;
  const tail = split < 0 ? [] : items.slice(split);
  // Headings after the first Complementary one are its own unless each states its credits.
  const separate = tail.every(
    (item) => item.kind === "section" && hasOwnCredits(item),
  );
  return [
    required,
    ...(extra ? [extra] : []),
    ...(separate
      ? tail.flatMap((item) =>
          item.kind === "section" ? groupsOf(item, ctx) : [],
        )
      : nested?.kind === "section"
        ? groupsOf(
            { ...nested, items: [...nested.items, ...items.slice(split + 1)] },
            ctx,
          )
        : []),
  ];
}

/** Headings with no credits right below a Required heading whose courses make up exactly what its total says it lacks, as "Thesis Courses" under a "Required Courses (36 credits)" that lists 5, join it. Returns the sections it took. */
function absorbBelow(required: RequiredGroup, after: Section[]): Section[] {
  let short = required.credits - (LISTED.get(required) ?? required.credits);
  const taken: RequiredGroup[] = [];
  for (const section of after) {
    if (short <= 0 || LOWER.has(required)) break;
    // "one hour per week ... OR one and a half hours per week": the first way counts, as under a Required heading.
    const cut = section.items.findIndex(
      (item) => item.kind === "text" && /^or$/i.test(item.text),
    );
    const items = cut < 0 ? section.items : section.items.slice(0, cut);
    const plain = items.every(
      (item) =>
        item.kind === "table" ||
        (item.kind === "text" &&
          !constraint(item.text) &&
          !listAmount(item.text)),
    );
    const group =
      plain && !hasOwnCredits(section) && requiredGroup({ ...section, items });
    if (!group) return [];
    if (cut >= 0) group.note = ALTERNATIVE_NOTE;
    taken.push(group);
    short -= LISTED.get(group) ?? 0;
  }
  if (short !== 0 || taken.length === 0) return [];
  required.courses = dedupe([
    ...required.courses,
    ...taken.flatMap((group) => group.courses),
  ]);
  const notes = [required.note, ...taken.map((group) => group.note)];
  if (notes.some(Boolean)) required.note = notes.filter(Boolean).join(" ");
  LISTED.set(required, required.credits);
  return after.slice(0, taken.length);
}

const PREREQUISITES = /^prerequisite courses$/i;

/** Music pages list a Foundation year's courses under the "Prerequisite Courses" heading after it, which the Foundation lines count as "22 credits of Prerequisite Courses". */
function foundationGroups(
  section: Section,
  next: Section,
  ctx: Context,
): Group[] {
  const own = events(section);
  if (own.every((e) => e.kind === "text" && bareTotal(e.text))) {
    const total =
      own[0]?.kind === "text" ? bareTotal(own[0].text)?.credits : undefined;
    return groupsOf(
      {
        ...next,
        title: section.title,
        min: section.min ?? total,
        max: section.max ?? total,
      },
      ctx,
    );
  }
  const line = section.items.findIndex(
    (item) =>
      item.kind === "text" &&
      /^\d+ credits of prerequisite courses$/i.test(item.text),
  );
  const credits = Number(
    /^\d+/.exec(
      section.items[line]?.kind === "text" ? section.items[line].text : "",
    )?.[0],
  );
  const prerequisites = requiredGroup(next);
  if (
    !prerequisites ||
    prerequisites.credits !== credits ||
    section.min === undefined ||
    section.max === undefined
  ) {
    return groupsOf(section, ctx);
  }
  prerequisites.foundation = true;
  const rest: Section = {
    ...section,
    min: section.min - credits,
    max: section.max - credits,
    items: section.items.filter((_, i) => i !== line),
  };
  return [...groupsOf(rest, ctx), prerequisites];
}

// The degree is the last parenthesis of the title, plus earlier ones joined to it by "or" or "and", as in "(B.Sc.(Ag.Env.Sc.)) or (B.Sc.)".
const PAREN = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const DEGREE = new RegExp(`((?:${PAREN}\\s+(?:or|and)\\s+)*${PAREN})$`);

function degreeAndName(heading: string, graduate: boolean) {
  const title = clean(heading.replace(HEADING_CREDITS, ""));
  // Graduate titles put a qualifier after the degree, as "Music (M.A.): Theory (Non-Thesis)": the degree is the last parenthesis holding dotted letters.
  if (graduate) {
    const dotted = [...title.matchAll(new RegExp(PAREN, "g"))]
      .filter((m) => /[A-Za-z]\./.test(m[0]))
      .at(-1);
    if (!dotted) return { name: title, degree: "" };
    return {
      name: clean(
        `${title.slice(0, dotted.index).trimEnd()}${title.slice(dotted.index + dotted[0].length)}`,
      ),
      degree: clean(dotted[0].slice(1, -1)),
    };
  }
  // French pages: "Baccalauréat ès Arts (B.A.) - Concentration majeure Langue et littérature françaises".
  const french = /^Baccalauréat[^()]*\(([^()]+)\)\s*-\s*(.+)$/.exec(title);
  if (french) return { name: french[2] ?? title, degree: french[1] ?? "" };
  const tail = DEGREE.exec(title);
  if (!tail || tail.index === 0) return { name: title, degree: "" };
  const degree = clean(
    (tail[1] ?? "").replace(new RegExp(PAREN, "g"), (p) => p.slice(1, -1)),
  );
  return { name: clean(title.slice(0, tail.index)), degree };
}

const FACULTY_BY_PATH: Record<string, string> = {
  "agri-env-sci": "Agricultural and Environmental Sciences",
  "arts-science": "Arts and Science",
  arts: "Arts",
  dentistry: "Dental Medicine and Oral Health Sciences",
  education: "Education",
  engineering: "Engineering",
  environment: "Environment",
  "interfaculty-studies": "Interfaculty Studies",
  law: "Law",
  management: "Management",
  "medicine-health-sciences": "Medicine and Health Sciences",
  music: "Music",
  nursing: "Medicine and Health Sciences",
  "physical-occupational-therapy": "Medicine and Health Sciences",
  science: "Science",
};

function facultyOf(offered: string, path: string): string {
  const named = /\(([^()]*)\)\s*$/.exec(offered)?.[1] ?? "";
  const faculties = named
    .split(";")
    .map((f) =>
      clean(f)
        .replace(/^.*?\b(?:Faculty|School) of /, "")
        .replace(/ & /g, " and "),
    )
    .filter(Boolean);
  if (faculties.length > 0) return faculties.join(" and ");
  return FACULTY_BY_PATH[path.split("/")[3] ?? ""] ?? "";
}

const WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const OVERLAP_AMOUNT = String.raw`(\d+|${Object.keys(WORDS).join("|")})`;
const amount = (word: string) => WORDS[word.toLowerCase()] ?? Number(word);

/** How many credits a minor's page lets count toward the student's program too, the smallest it states, or undefined when it says nothing. Courses count as 3 credits. */
export function overlapOf(text: string): number | undefined {
  const found: number[] = [];
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    if (
      /\bno (?:course )?overlap\b[^.]*\b(?:permitted|allowed)\b|\bpermits no overlap\b|\bmay be no overlap\b/i.test(
        sentence,
      )
    ) {
      found.push(0);
      continue;
    }
    const remainder =
      /(\d+) credits[^.]*?of which at least (\d+)[^.]*?must not overlap/i.exec(
        sentence,
      );
    if (remainder?.[1] && remainder[2]) {
      found.push(Number(remainder[1]) - Number(remainder[2]));
      continue;
    }
    const cap = new RegExp(
      String.raw`(?:maximum of|no more than|not more than|up to)\s+${OVERLAP_AMOUNT}(?:\s*-\s*\d+)?\s*(credits?|courses?)?(?:\s*\([^)]*\))?[^.]{0,80}?(?:double[- ]count|overlap|counted for both|count(?:ed)? (?:toward|for) both)`,
      "i",
    ).exec(sentence);
    const allowed = new RegExp(
      `${OVERLAP_AMOUNT} credits of overlap (?:are|is) (?:allowed|permitted)`,
      "i",
    ).exec(sentence);
    const match = cap ?? allowed;
    if (match?.[1]) {
      const n = amount(match[1]);
      found.push(/^course/i.test(cap?.[2] ?? "") ? n * 3 : n);
    }
  }
  return found.length > 0 ? Math.min(...found) : undefined;
}

/** Title of the group that makes up credits the program total asks for and no group of the page lists. */
export const TOTAL_TITLE = "Program total";

/** The most credits some groups can count toward the program total: a range at its top, and a required group no more than its courses add up to. */
const reach = (groups: readonly Group[]) =>
  groups.reduce(
    (n, g) =>
      n +
      (g.kind === "complementary"
        ? (g.maxCredits ?? g.credits)
        : Math.min(g.credits, LISTED.get(g) ?? g.credits)),
    0,
  );

/** Reads one program page. Returns null for pages with no requirements, such as department indexes. */
export function parseProgramPage(
  html: string,
  path: string,
  options: ParseOptions = {},
): Program | null {
  const $ = cheerio.load(html);
  const heading = clean($("h1.page-title").text());
  const year = catalogueYear(html);
  const overview = clean(
    $("#programoverviewtextcontainer, #gnralitstextcontainer").text(),
  );
  // The requirements are under the Courses tab, the graduate Program Requirements tab, else under the tab a few pages use instead, the one that has lists.
  const courses = $("#coursestextcontainer").length
    ? $("#coursestextcontainer")
    : $("#programrequirementstextcontainer");
  const container = courses.length
    ? courses
    : $(
        "#exigencestextcontainer, #newitemtextcontainer, #programoverviewtextcontainer",
      )
        .filter((_, el) => $(el).find("table").length > 0)
        .first();
  const total = new RegExp(
    String.raw`\(\s*${SPAN}\s*${CREDITS}\s*\)\s*$`,
    "i",
  ).exec(heading);
  const credits =
    Number(
      total?.[1] ??
        /Program credit weight:\s*(\d+(?:\.\d+)?)/.exec(overview)?.[1],
    ) || 0;
  // One French page's address ends its last word with a dash.
  const slug = path
    .split("/")
    .at(-2)
    ?.replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
  const graduate = path.startsWith("/en/graduate/");
  // A doctorate gives no credit total.
  if (!year || !slug || (!credits && !graduate)) return null;
  const ctx = { subjectsOf: options.subjectsOf ?? (() => []), graduate };

  const groups: Group[] = [];
  const sections = readSections($, container);
  const continues = (a: Section | undefined, b: Section | undefined) =>
    a && b && FOUNDATION.test(a.title) && PREREQUISITES.test(b.title);
  const absorbed = new Set<Section>();
  for (const [i, section] of sections.entries()) {
    if (absorbed.has(section) || continues(sections[i - 1], section)) continue;
    const next = sections[i + 1];
    const found =
      next && continues(section, next)
        ? foundationGroups(section, next, ctx)
        : groupsOf(section, ctx);
    groups.push(...found);
    const [only] = found;
    if (found.length === 1 && only?.kind === "required") {
      for (const below of absorbBelow(only, sections.slice(i + 1))) {
        absorbed.add(below);
      }
    }
    // A list under a heading such as "Group C" belongs to the complementary group before it, unless that group only asks a person to check it.
    const last = groups.at(-1);
    if (
      found.length === 0 &&
      /^(?:group|list) [A-Z\d]\b/i.test(section.title) &&
      last?.kind === "complementary" &&
      last.credits > 0
    ) {
      last.rules.push(...rulesOf(section, ctx));
    }
  }
  if (groups.length === 0) return null;
  // Some pages count a required range at its top and others at its bottom: take the bottom when only that adds up to the program total. Required groups are done when their courses are, so this changes no satisfaction.
  const ranged = groups.flatMap((g) =>
    g.kind === "required" && LOWER.has(g) ? [g] : [],
  );
  const sum = groups.reduce((n, g) => n + g.credits, 0);
  const slack = ranged.reduce(
    (n, g) => n + g.credits - (LOWER.get(g) ?? g.credits),
    0,
  );
  if (slack > 0 && sum !== credits && sum - slack === credits) {
    for (const g of ranged) g.credits = LOWER.get(g) ?? g.credits;
  }
  // An Honours page that lists only the Honours courses: the rest of its credits are the program it builds on, which has its own page.
  const base =
    /This program is open only to students in the (.+?)\. (To be eligible for Honours, students must satisfy the requirements set by their .+? degree)\./.exec(
      overview,
    );
  const counted = groups.reduce((n, g) => n + g.credits, 0);
  if (base && counted < credits) {
    groups.push({
      title: base[1] ?? "",
      kind: "complementary",
      credits: credits - counted,
      rules: [unparsed(base[0])],
    });
  }
  // Credits no group can count would leave the program short of its total forever, so a person checks them.
  const short = credits - reach(groups);
  if (short > 0) {
    groups.push({
      title: TOTAL_TITLE,
      kind: "complementary",
      credits: short,
      rules: [
        unparsed(
          `${short} more ${short === 1 ? "credit" : "credits"} to reach the program's ${credits} credits, which the catalogue page does not list in a group above`,
        ),
      ],
    });
  }

  const { name, degree } = degreeAndName(heading, graduate);
  const overlap = overlapOf(
    clean($("#programoverviewtextcontainer, #coursestextcontainer").text()),
  );
  const offered =
    /Offered by:\s*(.*?)\s*(?:Degree:|Program credit weight:|$)/.exec(
      overview,
    )?.[1] ?? "";
  return {
    id: slug,
    name,
    degree:
      degree ||
      /Degree:\s*([^;]*?)\s*(?:;|Program credit|$)/.exec(overview)?.[1] ||
      "",
    faculty: facultyOf(offered, path),
    catalogueYear: year,
    source: BASE_URL + path,
    credits,
    groups,
    ...(isMinor({ id: slug, degree }) && overlap !== undefined && { overlap }),
    ...(graduate && { level: "graduate" as const }),
    generated: true,
  };
}
