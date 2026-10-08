/** A course code leaf, or an AND/OR group of subtrees. */
export type RequirementTree =
  | string
  | { and: RequirementTree[] }
  | { or: RequirementTree[] };

export interface Requirement {
  /** The catalogue text, always kept so the UI can show it. */
  text: string;
  /** Course codes the text requires, or null when it names none. */
  tree: RequirementTree | null;
  /** True when the text has conditions the tree cannot express, such as permission or standing. */
  unparsed: boolean;
}

export interface Restriction {
  text: string;
  /** Courses that block this one when taken, read from "not open to students who have taken" clauses. */
  excludes: string[];
}

/** One term of a multi-term course, such as ECSE 458D1. */
export interface CoursePart {
  code: string;
  credits: number | null;
  terms: string[];
}

export interface Course {
  /** Logical code, such as "COMP 251". Multi-term courses drop the D1/D2 suffix. */
  code: string;
  subject: string;
  number: string;
  title: string;
  /** Total credits, summed over parts for multi-term courses. Null when the page gives none. */
  credits: number | null;
  offeredBy: string | null;
  faculty: string | null;
  /** Terms as the catalogue writes them, such as "Fall 2026", in chronological order. */
  terms: string[];
  description: string;
  prerequisites: Requirement | null;
  corequisites: Requirement | null;
  restrictions: Restriction | null;
  notes: string[];
  parts?: CoursePart[];
}

/** What the browser downloads: everything but the long text. */
export type CourseSummary = Omit<Course, "description" | "notes">;
