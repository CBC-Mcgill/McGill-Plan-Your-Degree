import { expect, test } from "vitest";
import { parseRequirement } from "./prereq.ts";

// Every input below is a real 2026-27 catalogue string.
test.each([
  [
    "ECSE 211 and ECSE 324 and (CCOM 206 OR WCOM 206) and (ECSE 331 or COMP 302)",
    {
      and: [
        "ECSE 211",
        "ECSE 324",
        { or: ["CCOM 206", "WCOM 206"] },
        { or: ["ECSE 331", "COMP 302"] },
      ],
    },
    false,
  ],
  [
    "BIOL 200, BIOL 201 or BIOC 212, CHEM 222 or CHEM 234",
    {
      and: [
        "BIOL 200",
        { or: ["BIOL 201", "BIOC 212"] },
        { or: ["CHEM 222", "CHEM 234"] },
      ],
    },
    false,
  ],
  [
    "HISP 218, MATH 203, and BIOL 215",
    { and: ["HISP 218", "MATH 203", "BIOL 215"] },
    false,
  ],
  [
    "ANTH 202 or 204 or 205 or 206 or 212 or permission of instructor",
    { or: ["ANTH 202", "ANTH 204", "ANTH 205", "ANTH 206", "ANTH 212"] },
    true,
  ],
  [
    "COMP 202 or COMP 204 or COMP 208 or CEGEP objective 0F01 or equivalent",
    { or: ["COMP 202", "COMP 204", "COMP 208"] },
    true,
  ],
  [
    "BIOL 200, BIOL 201 (or ANAT 212/BIOC 212); or BIOL 219",
    {
      and: [
        "BIOL 200",
        "BIOL 201",
        { or: ["ANAT 212", "BIOC 212"] },
        "BIOL 219",
      ],
    },
    true,
  ],
  ["a course in functions", null, true],
])("parses %s", (text, tree, unparsed) => {
  expect(parseRequirement(text)).toEqual({ text, tree, unparsed });
});
