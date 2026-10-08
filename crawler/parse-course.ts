import * as cheerio from "cheerio";
import type { Course } from "../lib/catalogue/types.ts";
import { EXCLUSION, parseRequirement, parseRestriction } from "./prereq.ts";

/** A course as one catalogue page shows it, before multi-term parts are merged. */
export type CoursePage = Omit<Course, "parts">;

// Labels vary: "Prerequisite(s) X", "Prerquisite(s):", "Revised Prerequisite:", "Prerequisite (Undergraduate):".
const LABEL_END = String.raw`(?:\s*\(s\))?(?:(?:\s*\((?![^)]*(?:\d{3}|one of))[^)]*\))?\s*[:.,]|(?=\s|$))`;
const PREREQ_LABEL = new RegExp(
  String.raw`^(?:revised\s+)?pre-?re?quisites?${LABEL_END}`,
  "i",
);
const COREQ_LABEL = new RegExp(`^co-?re?quisites?${LABEL_END}`, "i");
// "Prerequisites/Corequisites:" keeps its label so the text and the unparsed flag show it allows concurrent courses.
const COMBINED_LABEL =
  /^(?:revised\s+)?pre-?re?quisites?(?:\s*\(s\))?\s*\/\s*co-?re?quisites?/i;
const RESTRICTION_LABEL = /^restrictions?(?:\s*\(s\))?\s*[:.]/i;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function parseCoursePage(html: string): CoursePage {
  const $ = cheerio.load(html);
  const heading = clean($("h1.page-title").text());
  const match = /^(\S+) (\S+?)\.\s+(.+?)\.?$/.exec(heading);
  if (!match) throw new Error(`Unrecognized course heading: "${heading}"`);
  const [, subject = "", number = "", title = ""] = match;

  const field = (name: string) => {
    const value = clean($(`.detail-${name} .value`).first().text());
    return value || null;
  };

  const creditsText = field("credits");
  const credits = creditsText !== null ? Number(creditsText) : Number.NaN;

  const offered = field("offered_by");
  const unit = offered && /^(.*?)\s*\(([^()]*)\)$/.exec(offered);

  const items = $(".detail-note_text li")
    .map((_, li) => clean($(li).text()))
    .get()
    .filter(Boolean);

  const prereqItems = items.filter(
    (item) => PREREQ_LABEL.test(item) || COMBINED_LABEL.test(item),
  );
  const coreqItems = items.filter((item) => COREQ_LABEL.test(item));
  const restrictionItems = items.filter(
    (item) => RESTRICTION_LABEL.test(item) || EXCLUSION.test(item),
  );
  const notes = items.filter(
    (item) =>
      !prereqItems.includes(item) &&
      !coreqItems.includes(item) &&
      !restrictionItems.includes(item),
  );

  return {
    code: `${subject} ${number}`,
    subject,
    number,
    title,
    credits: Number.isFinite(credits) ? credits : null,
    offeredBy: unit ? (unit[1] ?? null) : offered,
    faculty: unit ? (unit[2] ?? null) : null,
    terms: (field("terms_offered") ?? "").split(",").map(clean).filter(Boolean),
    description: clean($(".section--description .section__content").text()),
    prerequisites: joined(prereqItems, PREREQ_LABEL, parseRequirement),
    corequisites: joined(coreqItems, COREQ_LABEL, parseRequirement),
    restrictions: joined(restrictionItems, RESTRICTION_LABEL, parseRestriction),
    notes,
  };
}

function joined<T>(
  items: string[],
  label: RegExp,
  parse: (text: string) => T,
): T | null {
  if (items.length === 0) return null;
  return parse(items.map((item) => item.replace(label, "").trim()).join("; "));
}
