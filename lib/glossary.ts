import meta from "../data/catalogue/meta.json";
import type { View } from "./engine/browse.ts";
import type { BrowseStatus } from "./engine/status.ts";
import type { CourseStatus } from "./profile/types.ts";

/** Every definition the app shows in a tooltip. `label` names the term for screen readers, so it matches the label on screen. */
export interface Definition {
  label: string;
  tip: string;
}

const checkTip =
  "We could not read this rule from the catalogue. Check it on the program page.";
const termsTip = `Terms the course runs in the ${meta.catalogueYear} catalogue.`;

export const GLOSSARY = {
  program: {
    label: "Program",
    tip: "The degree program you are in. It decides which courses are required.",
  },
  startTerm: {
    label: "Start term",
    tip: "Your first term at McGill. The planner starts here.",
  },
  graduation: {
    label: "Expected graduation",
    tip: "The last term you take courses. Finishing in April? Pick Winter, even if the ceremony is in May or June.",
  },
  entry: {
    label: "How you started at McGill",
    tip: "Quebec CEGEP students start in U1 and get credit for Year 0 or Foundation courses. Students from outside Quebec usually start in U0 with a Foundation year.",
  },
  advancedStanding: {
    label: "Advanced standing credits",
    tip: "Credits McGill gave you for studies before you arrived, such as CEGEP, AP or IB. They count toward your degree but are not tied to one course.",
  },
  creditsRequired: {
    label: "Credits required for your degree",
    tip: "Total credits you need to graduate. It comes from your program and how you started, so change it only if your advisor says so.",
  },
  creditLimit: {
    label: "Credit limit",
    tip: "Credits you can plan in one term before the planner warns you. Full time is 12 credits or more.",
  },
  creditsEarned: {
    label: "Credits earned",
    tip: "Credits from courses you completed, plus advanced standing and transfer credits. Courses in progress count once they are done.",
  },
  programCredits: {
    label: "Program credits",
    tip: "Credits that count toward your program's requirements, including courses you are taking now.",
  },
  required: {
    label: "Required courses",
    tip: "Courses everyone in your program must take.",
  },
  complementary: {
    label: "Complementary courses",
    tip: "Courses you choose from lists in your program, up to the credits it asks for.",
  },
  requirementCredits: {
    label: "Credits counted",
    tip: "Credits from your completed, current and planned courses, up to what each requirement needs.",
  },
  notCounted: {
    label: "Not counted toward your program",
    tip: "No requirement of your program took these courses. They still count toward your degree's total credits as electives.",
  },
  checkRequirement: { label: "Check this requirement", tip: checkTip },
  checkRules: { label: "Rules to check", tip: checkTip },
  warnings: {
    label: "Warnings",
    tip: "Problems the planner found, like a missing prerequisite or a course not offered that term. They do not block your plan.",
  },
  termsOffered: { label: "Terms offered", tip: termsTip },
  offered: { label: "Offered", tip: termsTip },
  credits: {
    label: "Credits",
    tip: "Credits you earn by passing the course. A course taken over two terms gives its credits once the last part is done.",
  },
  offeredBy: {
    label: "Offered by",
    tip: "The department or school that teaches the course.",
  },
  multiTerm: {
    label: "Multi-term courses",
    tip: "Taken over two consecutive terms, for example ECSE 458D1 in Fall and ECSE 458D2 in Winter.",
  },
  notOpen: {
    label: "Not open in this term",
    tip: "Required courses you cannot take that term yet, with what is missing.",
  },
  termLoad: {
    label: "Credits planned this term",
    tip: "Credits planned for this term against your credit limit.",
  },
  plannedNext: {
    label: "Planned next term",
    tip: "Credits you added to your plan for next term.",
  },
  termsLeft: {
    label: "Terms left",
    tip: "Fall and Winter terms you have left, up to and including your expected graduation term.",
  },
  planCovers: {
    label: "Your plan covers",
    tip: "Program credits that your completed, current and planned courses add up to.",
  },
  stillMissing: {
    label: "Still missing",
    tip: "What the plan does not cover yet, such as required courses and credits left in complementary lists.",
  },
  planGraduation: {
    label: "Graduation",
    tip: "The last term on your path. It follows the expected graduation on your profile.",
  },
  hasConditions: {
    label: "Has conditions",
    tip: "The catalogue lists a condition we can't check, like instructor permission.",
  },
} satisfies Record<string, Definition>;

/** One sentence for each status word. A reason, such as "Needs COMP 250 first", replaces it where the app has one. */
export const STATUS_TIPS: Record<BrowseStatus | CourseStatus, string> = {
  available: "You have the prerequisites and no restriction blocks you.",
  locked: "You are missing a prerequisite, or a restriction blocks the course.",
  planned: "You added this course to a term in your plan.",
  "in-progress": "You are taking this course now.",
  completed: "You finished this course.",
  covered:
    "Your Science DEC covers this course, so you do not need to take it. It gives no McGill credit.",
  transfer: "McGill gave you credit for this course from earlier studies.",
  exemption:
    "You are exempt from this course. It meets prerequisites but earns no credit.",
  failed: "You did not pass this course, so it earns no credit.",
  withdrawn: "You withdrew from this course, so it earns no credit.",
  deferred: "The final grade is not in yet. The course counts once it is.",
};

/** What each saved view of the course table holds. */
export const VIEW_TIPS: Record<View, string> = {
  all: "Every course in the catalogue.",
  "can-take":
    "Courses you can take now: you have the prerequisites, it runs this year and it is an undergraduate course.",
  program: "Courses your program requires, or lets you choose from.",
  planned: "Courses you added to your plan.",
  completed:
    "Courses you have finished, including transfer credits and exemptions.",
};
