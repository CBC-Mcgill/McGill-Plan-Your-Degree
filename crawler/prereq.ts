import type {
  Requirement,
  RequirementTree,
  Restriction,
} from "../lib/catalogue/types.ts";

type Join = "and" | "or" | "comma";
type Joined = { join: Join; afterComma: boolean };
type Token =
  | { type: "code"; value: string }
  | { type: Join | "semi" | "open" | "close" | "oneOf" | "word" };

const CODE = /^([A-Z]{4}|[A-Z]{3}\d)\s*-?\s*(\d{3}(?:[DJN]\d)?)\b/;
const BARE_NUMBER = /^(\d{3}(?:[DJN]\d)?)\b(?!\s*-?\s*(?:level|credits?)\b)/i;
const ONE_OF = /^one of(?: the following)?(?: courses)?\s*:?/i;
const SYMBOLS: Record<string, Token["type"]> = {
  ";": "semi",
  ".": "semi",
  ":": "semi",
  ",": "comma",
  "(": "open",
  "[": "open",
  ")": "close",
  "]": "close",
  "/": "or",
  "&": "and",
  "+": "and",
};
// Words that only connect course codes, so they do not make a requirement unparsed.
const FILLER = new Set([
  "both",
  "either",
  "the",
  "following",
  "course",
  "courses",
  "all",
  "of",
]);

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let subject: string | null = null;
  let rest = text.trim();
  while (rest.length > 0) {
    const previous = tokens.at(-1)?.type;
    const code = CODE.exec(rest);
    const bare = BARE_NUMBER.exec(rest);
    const oneOf = ONE_OF.exec(rest);
    const symbol = SYMBOLS[rest[0] ?? ""];
    let length: number;
    if (code) {
      subject = code[1] ?? null;
      tokens.push({ type: "code", value: `${code[1]} ${code[2]}` });
      length = code[0].length;
    } else if (
      bare &&
      subject &&
      (previous === "or" || previous === "and" || previous === "comma")
    ) {
      // "MATH 222 or 223" repeats the subject of the code before it.
      tokens.push({ type: "code", value: `${subject} ${bare[1]}` });
      length = bare[0].length;
    } else if (oneOf) {
      tokens.push({ type: "oneOf" });
      length = oneOf[0].length;
    } else if (symbol) {
      tokens.push({ type: symbol } as Token);
      length = 1;
    } else {
      const word = /^(?:and\/or\b|[^\s;.:,()[\]/&+]+)/i.exec(rest)?.[0] ?? rest;
      const lower = word.toLowerCase();
      if (lower === "and" || lower === "plus") tokens.push({ type: "and" });
      else if (lower === "or" || lower === "and/or")
        tokens.push({ type: "or" });
      else if (!FILLER.has(lower)) tokens.push({ type: "word" });
      length = word.length;
    }
    rest = rest.slice(length).trimStart();
  }
  return tokens;
}

class Parser {
  private index = 0;
  private readonly tokens: Token[];
  ambiguous = false;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek() {
    return this.tokens[this.index]?.type;
  }

  parseAll(): RequirementTree | null {
    const clauses: RequirementTree[] = [];
    while (this.index < this.tokens.length) {
      const clause = this.parseClauses();
      if (clause) clauses.push(clause);
      if (this.peek() === "close") {
        this.ambiguous = true;
        this.index++;
      }
    }
    return group("and", clauses);
  }

  /** Semicolons and periods separate clauses that all apply. */
  private parseClauses(): RequirementTree | null {
    const clauses: RequirementTree[] = [];
    while (this.index < this.tokens.length && this.peek() !== "close") {
      if (this.peek() === "semi") this.index++;
      else {
        const clause = this.parseList();
        if (clause) clauses.push(clause);
      }
    }
    return group("and", clauses);
  }

  /** Operands joined by and, or, and commas. A comma takes the operator its list uses. */
  private parseList(oneOf = false): RequirementTree | null {
    const operands: RequirementTree[] = [];
    const joins: Joined[] = [];
    let pending: Join | null = null;
    let afterComma = false;
    while (this.index < this.tokens.length) {
      const type = this.peek();
      if (type === "semi" || type === "close") break;
      if (type === "and" || type === "or" || type === "comma") {
        if (type === "comma") afterComma = true;
        // ", or" and ", and" read as the word.
        if (pending === null || pending === "comma") pending = type;
        this.index++;
      } else if (type === "word") {
        pending = null;
        afterComma = false;
        this.index++;
      } else {
        const operand = this.parseOperand();
        if (operand === null) continue;
        if (operands.length > 0) {
          const join = pending ?? "and";
          joins.push({ join, afterComma: afterComma && join !== "comma" });
        }
        operands.push(operand);
        pending = null;
        afterComma = false;
      }
    }
    return this.combine(operands, joins, oneOf);
  }

  private parseOperand(): RequirementTree | null {
    const token = this.tokens[this.index++];
    if (token?.type === "code") return token.value;
    if (token?.type === "oneOf") return this.parseList(true);
    if (token?.type !== "open") return null;
    const inner = this.parseClauses();
    if (this.peek() === "close") this.index++;
    else this.ambiguous = true;
    return inner;
  }

  private combine(
    operands: RequirementTree[],
    joins: Joined[],
    oneOf: boolean,
  ): RequirementTree | null {
    // "A or B, and C" reads as (A or B) and C: a comma before a word splits the list at that word.
    const strong = new Set(
      joins.filter((j) => j.afterComma).map((j) => j.join),
    );
    const weak = new Set(
      joins
        .filter((j) => !j.afterComma && j.join !== "comma")
        .map((j) => j.join),
    );
    const [outer] = strong;
    const [inner] = weak;
    if (strong.size === 1 && weak.size === 1 && outer !== inner && outer) {
      return group(
        outer === "or" ? "or" : "and",
        this.split(operands, joins, (j) => j.afterComma)
          .map(([segment, segmentJoins]) =>
            this.combineFlat(segment, segmentJoins, oneOf),
          )
          .filter((tree) => tree !== null),
      );
    }
    return this.combineFlat(operands, joins, oneOf);
  }

  private combineFlat(
    operands: RequirementTree[],
    joins: Joined[],
    oneOf: boolean,
  ): RequirementTree | null {
    const words = new Set(
      joins.filter((j) => j.join !== "comma").map((j) => j.join),
    );
    const hasComma = joins.some((j) => j.join === "comma");
    const oxford = joins.some((j) => j.afterComma && j.join === "or");
    if (hasComma && !oneOf && !oxford && words.size === 1 && words.has("or")) {
      // "A, B or C, D or E": commas join the items, "or" joins inside each item.
      const segments = this.split(operands, joins, (j) => j.join === "comma");
      const withOr = segments.filter(([, inside]) => inside.length > 0);
      // "A, B or C" may also be a list of alternatives, so flag it.
      if (withOr.length === 1 && withOr[0] === segments.at(-1)) {
        this.ambiguous = true;
      }
      return group(
        "and",
        segments
          .map(([segment]) => group("or", segment))
          .filter((tree) => tree !== null),
      );
    }
    const commaMeans =
      oneOf || (words.size === 1 && words.has("or")) ? "or" : "and";
    const resolved = joins.map((j) =>
      j.join === "comma" ? commaMeans : j.join,
    );
    if (new Set(resolved).size > 1) this.ambiguous = true;
    // ponytail: other unbracketed and/or mixes bind "and" tighter and get flagged unparsed.
    const alternatives: RequirementTree[][] = [[]];
    operands.forEach((operand, i) => {
      if (i > 0 && resolved[i - 1] === "or") alternatives.push([]);
      alternatives.at(-1)?.push(operand);
    });
    return group(
      "or",
      alternatives
        .map((all) => group("and", all))
        .filter((tree) => tree !== null),
    );
  }

  /** Splits operands at the joins that match, keeping the joins inside each part. */
  private split(
    operands: RequirementTree[],
    joins: Joined[],
    at: (join: Joined) => boolean,
  ): [RequirementTree[], Joined[]][] {
    const parts: [RequirementTree[], Joined[]][] = [[[], []]];
    operands.forEach((operand, i) => {
      const before = joins[i - 1];
      if (before && at(before)) parts.push([[], []]);
      else if (before) parts.at(-1)?.[1].push(before);
      parts.at(-1)?.[0].push(operand);
    });
    return parts;
  }
}

/** Builds a flat, deduplicated group, collapsing single children. */
function group(
  op: "and" | "or",
  children: RequirementTree[],
): RequirementTree | null {
  const flat: RequirementTree[] = [];
  const seen = new Set<string>();
  for (const child of children) {
    const items =
      typeof child === "object" && op in child
        ? op === "and"
          ? (child as { and: RequirementTree[] }).and
          : (child as { or: RequirementTree[] }).or
        : [child];
    for (const item of items) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        flat.push(item);
      }
    }
  }
  if (flat.length <= 1) return flat[0] ?? null;
  return op === "and" ? { and: flat } : { or: flat };
}

export function parseRequirement(text: string): Requirement {
  const tokens = tokenize(text);
  const parser = new Parser(tokens);
  const tree = parser.parseAll();
  const hasConditions = tokens.some((token) => token.type === "word");
  return {
    text,
    tree,
    unparsed: tree === null || hasConditions || parser.ambiguous,
  };
}

export const EXCLUSION =
  /not open to students who (?:have taken|are taking|have passed)/i;

export function parseRestriction(text: string): Restriction {
  const excludes = new Set<string>();
  for (const clause of text.split(/;|\.\s|\d\)\s/)) {
    if (!EXCLUSION.test(clause)) continue;
    const courses = clause.replace(/,?\s*except\b.*$/i, "");
    for (const token of tokenize(courses)) {
      if (token.type === "code") excludes.add(token.value);
    }
  }
  return { text, excludes: [...excludes].sort() };
}
