import * as cheerio from "cheerio";
import { logicalCode } from "../lib/profile/types.ts";
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

const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const trimEnd = (text: string) => text.replace(/[\s:;.]+$/, "");
const CODE = String.raw`[A-Z]{3}[A-Z\d] \d{3}(?:[DJN]\d)?`;
const CODE_G = new RegExp(String.raw`\b${CODE}\b`, "g");
const codesIn = (text: string) =>
  [...text.matchAll(CODE_G)].map((m) => logicalCode(m[0]));
const skeleton = (text: string) => text.replace(CODE_G, "CODE");
const NUM = String.raw`(\d+(?:\.\d+)?)`;
const RANGE = String.raw`${NUM}(?:\s*[-–]\s*${NUM})?`;
const sentences = (text: string) =>
  text
    .split(/(?<=[.:;])\s+(?=[A-Z(])/)
    .map(clean)
    .filter(Boolean);

/** The catalogue year the page belongs to, such as 2026-2027. */
export function catalogueYear(html: string): string | null {
  return /(\d{4}-\d{4}) Undergraduate Catalogue/.exec(html)?.[1] ?? null;
}

const HEADING_CREDITS = new RegExp(
  String.raw`\s*\(\s*${RANGE}\s*credits?\s*\)\s*$`,
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
    credits: Number(clean(tr.children("td.hourscol").text())) || 0,
    or: /^or\s/i.test(cell) || tr.hasClass("orclass"),
  };
}

/** Flattens the Courses tab into a tree of headings holding paragraphs, tables and their footnotes, in page order. */
function readSections($: cheerio.CheerioAPI): Section[] {
  $(".sc_courseinline").each((_, el) => {
    $(el).replaceWith($(el).find("a.code").first().text() || $(el).text());
  });
  const text = (el: Q) => clean(el.clone().find("sup").remove().end().text());
  const root: Section = { kind: "section", level: 1, title: "", items: [] };
  const stack = [root];
  const add = (item: Section | Table | Text) => {
    stack.at(-1)?.items.push(item);
  };
  const walk = (parent: Q) => {
    for (const child of parent.children().toArray()) {
      const el = $(child);
      const tag = child.tagName;
      if (/^h[2-6]$/.test(tag)) {
        const level = Number(tag[1]);
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
  walk($("#coursestextcontainer"));
  const drop = (section: Section) => {
    section.items = section.items.filter(
      (item) => item.kind !== "text" || item.text,
    );
    for (const item of section.items) if (item.kind === "section") drop(item);
  };
  drop(root);
  return root.items.filter((item) => item.kind === "section");
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
  "up to": "max",
  "at most": "max",
  "a maximum of": "max",
  "maximum of": "max",
  "no more than": "max",
};
const AMOUNT = new RegExp(
  String.raw`^(at least |a minimum of |minimum of |up to |at most |a maximum of |maximum of |no more than )?${RANGE}\s*credits?(?:\s*\(\s*${RANGE}\s*courses?\s*\))?`,
  "i",
);
// What can follow the credits when a table comes next: "from:", "selected from the following list:", "of Arabic (3 levels) from the list below."
const LIST_TAIL =
  /^,?\s*(?:ordinarily |usually )?(?:selected |chosen |taken )?(?:(?:from|of)\b[^:.;]*?\b(?:following|below|list)(?: courses| list| of courses)?(?: below)?(?: or their equivalent)?|from)\s*[:.]?$/i;
const FROM_UNION =
  /^,?\s*(?:selected |chosen )?from the following list or the previous(?: list)?\s*[:.]?$/i;

interface Amount {
  minCredits?: number;
  maxCredits?: number;
  minCourses?: number;
  maxCourses?: number;
}

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
    amount.minCourses = Number(m[4]);
    amount.maxCourses = m[5] === undefined ? Number(m[4]) : Number(m[5]);
  }
  return amount;
}

/** "3-9 credits selected from:" or "One of:" in front of a table. */
function listAmount(text: string): (Amount & { union?: true }) | null {
  const m = AMOUNT.exec(text);
  if (m) {
    const rest = text.slice(m[0].length);
    if (LIST_TAIL.test(rest)) return amountOf(m);
    if (FROM_UNION.test(rest)) return { ...amountOf(m), union: true };
    const count = new RegExp(
      String.raw`^,\s*(${COUNT_WORD}) of the following(?: courses)?\s*[:.]?$`,
      "i",
    ).exec(rest);
    if (count) {
      const n = COUNTS[(count[1] ?? "").toLowerCase()];
      return { ...amountOf(m), minCourses: n, maxCourses: n };
    }
  }
  const one = new RegExp(
    String.raw`^(${COUNT_WORD}) of(?: the following)?(?:[\w\s-]*?courses?)?(?: below)?(?: or (?:their )?equivalents?)?(?: \([^)]*\))?\s*[:.]?$`,
    "i",
  ).exec(text);
  const n = one && COUNTS[(one[1] ?? "").toLowerCase()];
  return n ? { minCourses: n, maxCourses: n } : null;
}

/** A total with nothing to choose from, such as "9-12 credits (3 courses) must be taken, chosen as follows:". */
const BARE_TOTAL = new RegExp(
  String.raw`^(?:students (?:must |should )?(?:choose|select|take) )?${RANGE}\s*credits?(?:\s*\(\s*${NUM}(?:\s*[-–]\s*\d+)?\s*courses?\s*\))?(?:,?\s*(?:must be taken|(?:are )?selected|chosen|of complementary courses (?:are )?selected|all of the courses below)(?:,?\s*(?:chosen |selected )?(?:as follows|as described below)(?:,?\s*in consultation with[^:.]*)?)?)?\s*[:.]?$`,
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

function levelOf(text: string): Match | null {
  const m = /^(\d{3})[- ]level(?: or (above|higher))?$/i.exec(text);
  if (!m) return null;
  const level = Number(m[1]);
  // Nothing above the 500 level is an undergraduate course.
  return m[2] || level === 500
    ? { minLevel: level }
    : { minLevel: level, maxLevel: level };
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

/** "At least 6 credits at the 400-level or above" with no list to choose from. */
function parseLevelOnly(text: string): Rule | null {
  const m = AMOUNT.exec(text);
  const rest = m && text.slice(m[0].length);
  const at =
    rest && /^,?\s*(?:must be |selected |may be )?at the (.*?)\.?$/i.exec(rest);
  const match = at && levelOf(at[1] ?? "");
  return m && match ? { title: trimEnd(text), ...amountOf(m), match } : null;
}

/** "N credits from Group A" or "from List B", naming a table by its heading. */
const NAMED = new RegExp(
  String.raw`^${RANGE}\s*credits?(?:\s*\(\s*${RANGE}\s*courses?\s*\))?\s*(?:selected |chosen )?(?:from|of) (?:the courses in )?((?:Group|List) [A-Z\d])\.?$`,
  "i",
);

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
// Notices that repeat the group total or only describe transfer credit.
const NOISE =
  /^(?:generally,|only \d+ credits will be applied to the program|\d+ credits will be applied to the program)/i;
const DEPARTMENT_LINE =
  /^[A-Za-z&,'-][A-Za-z&,'\s-]{1,60} \([A-Z]{3}[A-Z\d]\b[^)]*\)/;

const unparsed = (text: string): Rule => ({
  title: trimEnd(text),
  unparsed: true,
});

interface Context {
  subjectsOf: (department: string) => string[];
}

function noteRules(notes: string[]): Rule[] {
  return notes.flatMap((note) => {
    const parsed = parseNote(note);
    if (parsed && "either" in parsed) {
      return [{ title: trimEnd(note), maxCourses: 1, courses: parsed.either }];
    }
    if (parsed) return [parsed];
    return CONSTRAINT.test(note) ? [unparsed(note)] : [];
  });
}

const tablesIn = (section: Section): Table[] =>
  events(section).filter((e) => e.kind === "table");
const textsIn = (section: Section) =>
  events(section).flatMap((e) => (e.kind === "text" ? [e.text] : []));
const unique = (codes: string[]) => [...new Set(codes)];
const coursesOf = (tables: Table[]) =>
  unique(tables.flatMap((t) => t.rows.flatMap((row) => row.codes)));

/** The rules of a complementary group, from its tables and the sentences around them. */
function rulesOf(section: Section, ctx: Context): Rule[] {
  const rules: Rule[] = [];
  const named = new Map<string, Rule>();
  const narrative: string[] = [];
  let previous: string[] = [];

  const visit = (sec: Section, label: string) => {
    const children = sec.items.filter((i) => i.kind === "section");
    const direct = sec.items.filter((i) => i.kind === "table");
    const own = sec.items.flatMap((i) => (i.kind === "text" ? [i.text] : []));
    const statement = own.findLast((t) => listAmount(t));
    const subTables = tablesIn(sec);
    // "3-6 credits from the following:" above several labelled lists is one rule over all of them.
    if (
      statement &&
      direct.length === 0 &&
      subTables.length > 1 &&
      !children.some((c) => textsIn(c).some((t) => listAmount(t)))
    ) {
      const { union: _, ...amount } = listAmount(statement) ?? {};
      rules.push({
        title: [label, trimEnd(statement)].filter(Boolean).join(": "),
        courses: coursesOf(subTables),
        ...amount,
      });
      narrative.push(...own.filter((t) => t !== statement));
      for (const child of children) narrative.push(...textsIn(child));
      for (const table of subTables) rules.push(...noteRules(table.notes));
      return;
    }
    let pending: string[] = [];
    // A statement above several tables with no statement of their own is about all of them.
    let run: Rule | null = null;
    for (const item of sec.items) {
      if (item.kind === "text") {
        pending.push(item.text);
      } else if (item.kind === "section") {
        narrative.push(...pending);
        pending = [];
        run = null;
        visit(item, item.title);
      } else {
        const bound = pending.findLast((p) => listAmount(p));
        const found = bound ? listAmount(bound) : null;
        const name = pending.findLast(
          (p) => p.length <= 60 && !/[.:;]/.test(p) && !/^or$/i.test(p),
        );
        narrative.push(...pending.filter((p) => p !== bound && p !== name));
        pending = [];
        const courses = coursesOf([item]);
        if (courses.length === 0) continue;
        const notes = noteRules(item.notes);
        if (run && !found) {
          run.courses = unique([...(run.courses ?? []), ...courses]);
          previous = courses;
          rules.push(...notes);
          continue;
        }
        const { union, ...amount } = found ?? {};
        const rule: Rule = {
          title:
            [name ?? label, bound && trimEnd(bound)]
              .filter(Boolean)
              .join(": ") || section.title,
          courses: union ? unique([...previous, ...courses]) : courses,
          ...amount,
        };
        rules.push(rule, ...notes);
        if (found) run = rule;
        const id = /^(?:Group|List) [A-Z\d]\b/i.exec(label)?.[0];
        if (id && !found) named.set(id.toLowerCase(), rule);
        previous = courses;
      }
    }
    narrative.push(...pending);
  };
  visit(section, "");

  const statements: string[] = [];
  for (const text of narrative.flatMap(sentences)) {
    if (DEPARTMENT_LINE.test(text) && statements.length > 0) {
      statements[statements.length - 1] += `; ${text}`;
    } else statements.push(text);
  }
  for (const text of statements) {
    if (bareTotal(text) || NOISE.test(text) || !CONSTRAINT.test(text)) {
      continue;
    }
    const ref = NAMED.exec(text);
    const target = ref && named.get((ref[ref.length - 1] ?? "").toLowerCase());
    const amount = AMOUNT.exec(text);
    if (target && amount) {
      Object.assign(target, amountOf(amount));
      target.title = `${target.title}: ${trimEnd(text)}`;
      continue;
    }
    rules.push(
      parseSource(text, ctx.subjectsOf) ??
        parseLevelOnly(text) ??
        parseAnyCourse(text) ??
        unparsed(text),
    );
  }
  return rules;
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
    const choices = intro.flatMap((t) => listAmount(t) ?? []);
    // "6 credits from the following" under a Required heading is a choice, so the list is not required.
    if (choices.some((c) => c.maxCourses !== 1)) return null;
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
  const group: RequiredGroup = {
    title: section.title,
    kind: "required",
    credits:
      section.max ??
      rows.filter((r) => !r.or).reduce((sum, r) => sum + r.credits, 0),
    courses: dedupe(items),
  };
  if (FOUNDATION.test(section.title)) group.foundation = true;
  if (notes.length > 0) group.note = notes.join(" ");
  return group;
}

/** "AND 3 credits Natural Science complementary courses" after a required list, with subject lines such as "Physics (PHYS)". */
function additionalCredits(section: Section): ComplementaryGroup | null {
  const all = events(section);
  const after = all
    .slice(all.findLastIndex((e) => e.kind === "table") + 1)
    .flatMap((e) => (e.kind === "text" ? [e.text] : []));
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
    (first?.kind === "text" && bareTotal(first.text) !== null)
  );
};

const leadingCredits = (section: Section) => {
  const first = section.items.find((i) => i.kind === "text");
  const m = first?.kind === "text" ? AMOUNT.exec(first.text) : null;
  return m && !m[1] ? Number(m[2]) : undefined;
};

function complementaryGroups(section: Section, ctx: Context): Group[] {
  const children = section.items.filter((i) => i.kind === "section");
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
      complementaryGroups(
        { ...child, title: `${section.title} ${child.title}` },
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
  const rules = rulesOf(section, ctx);
  const text = events(section).flatMap((e) =>
    e.kind === "text" ? [e.text] : [],
  );
  const total = text[0] ? bareTotal(text[0]) : null;
  const stated = text.map((t) => AMOUNT.exec(t)).find((m) => m && !m[1]);
  const credits = section.min ?? total?.credits ?? Number(stated?.[2]);
  if (!credits) return [];
  const group: ComplementaryGroup = {
    title: section.title,
    kind: "complementary",
    credits,
    rules: rules.length > 0 ? rules : [unparsed(section.title)],
  };
  if (total?.minCourses) group.minCourses = total.minCourses;
  if (FOUNDATION.test(section.title)) group.foundation = true;
  return [group];
}

const SEPARATE = /complementary|elective/i;
const ALTERNATIVE = /^alternative|^option\b/i;

function groupsOf(section: Section, ctx: Context): Group[] {
  const title = section.title;
  if (/prerequisite/i.test(title) && !FOUNDATION.test(title)) return [];
  if (!/\brequired\b/i.test(title) || SEPARATE.test(title)) {
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
    required.note = [
      required.note,
      "The catalogue also lists an alternative set of required courses.",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const extra = additionalCredits(own);
  if (extra) required.credits -= extra.credits;
  return [
    required,
    ...(extra ? [extra] : []),
    ...(nested?.kind === "section"
      ? groupsOf(
          { ...nested, items: [...nested.items, ...items.slice(split + 1)] },
          ctx,
        )
      : []),
  ];
}

// The degree is the last parenthesis of the title, plus earlier ones joined to it by "or" or "and", as in "(B.Sc.(Ag.Env.Sc.)) or (B.Sc.)".
const PAREN = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const DEGREE = new RegExp(`((?:${PAREN}\\s+(?:or|and)\\s+)*${PAREN})$`);

function degreeAndName(heading: string) {
  const title = clean(heading.replace(HEADING_CREDITS, ""));
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
  education: "Education",
  engineering: "Engineering",
  environment: "Environment",
  law: "Law",
  management: "Management",
  music: "Music",
  science: "Science",
};

function facultyOf(offered: string, path: string): string {
  const named = /\(([^()]*)\)\s*$/.exec(offered)?.[1] ?? "";
  const faculties = named
    .split(";")
    .map((f) => clean(f).replace(/^.*?\b(?:Faculty|School) of /, ""))
    .filter(Boolean);
  if (faculties.length > 0) return faculties.join(" and ");
  return FACULTY_BY_PATH[path.split("/")[3] ?? ""] ?? "";
}

/** Reads one program page. Returns null for pages with no requirements, such as department indexes. */
export function parseProgramPage(
  html: string,
  path: string,
  options: ParseOptions = {},
): Program | null {
  const $ = cheerio.load(html);
  const heading = clean($("h1.page-title").text());
  const year = catalogueYear(html);
  const overview = clean($("#programoverviewtextcontainer").text());
  const total = new RegExp(
    String.raw`\(\s*${RANGE}\s*credits?\s*\)\s*$`,
    "i",
  ).exec(heading);
  const credits = Number(
    total?.[1] ??
      /Program credit weight:\s*(\d+(?:\.\d+)?)/.exec(overview)?.[1],
  );
  const slug = path.split("/").at(-2);
  if (!year || !slug || !credits) return null;
  const ctx = { subjectsOf: options.subjectsOf ?? (() => []) };

  const groups: Group[] = [];
  for (const section of readSections($)) {
    const found = groupsOf(section, ctx);
    groups.push(...found);
    // A list under a heading such as "Group C" belongs to the complementary group before it.
    const last = groups.at(-1);
    if (
      found.length === 0 &&
      /^(?:group|list) [A-Z\d]\b/i.test(section.title) &&
      last?.kind === "complementary"
    ) {
      last.rules.push(...rulesOf(section, ctx));
    }
  }
  if (groups.length === 0) return null;

  const { name, degree } = degreeAndName(heading);
  const offered =
    /Offered by:\s*(.*?)\s*(?:Degree:|$)/.exec(overview)?.[1] ?? "";
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
    generated: true,
  };
}
