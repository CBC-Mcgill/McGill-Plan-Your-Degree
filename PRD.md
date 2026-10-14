# McGill Plan Your Degree - Product Spec

**Status:** v3, matches the live app at https://plan-your-degree.vercel.app
**Date:** 2026-10-13
**Owner:** Thai (solo)
**License:** MIT, open source, plus one hosted web app

## 1. Problem Statement

McGill students plan four or more years of courses from a catalogue of about 10,100 course pages, free-text prerequisites, and program pages that are hard to read side by side.
Working out what you are allowed to take next, and what you still must take to graduate, means cross-checking your Minerva transcript, your program page, and each course's prerequisites by hand every registration period.
Mistakes surface late, as a blocked registration or a missing required course in final year.
Visual Schedule Builder handles timetables, mcgill.courses offers course search and student reviews, and the catalogue holds the rules, but nothing connects a student's actual record to their program and turns it into a plan.
Evidence so far is anecdotal (firsthand experience and the v1 PRD), and validating with real students is open question 2.

## 2. Goals

1. A student goes from transcript PDF to a correct "what's next" view in under 3 minutes, with no manual course entry.
2. A student in any McGill program builds a plan to graduation where every prerequisite and program requirement is satisfied, in one session.
3. The catalogue stays correct every term through one reviewed data PR per crawl, with no hand-entered course data.
4. A student whose program has a rule the crawler could not read can fix it in a PR without help from the maintainer.

## 3. Non-Goals

| Non-goal | Why it is out |
|---|---|
| AI course advisor answers | Needs trustworthy course data first. The chat ships as a preview (P1-8), and real answers come later (P2). |
| Timetables and section times | Visual Schedule Builder already does this, so we link to it (P1-3). |
| Registering for courses or touching Minerva | No public API, and acting on a student's account is a liability. |
| Hand-checked requirements for every program | The crawler reads all 944 programs and only 5 are checked by hand. Rules it cannot read become checks a student resolves (P0-11). |
| Degree audit PDF import | The transcript already gives completed courses. A second parser adds little. |
| Native apps and French UI | The web app has its own phone and tablet layouts (P0-9). French is P2. |

## 4. User Stories

- As a new CS student, I want to browse every McGill course and see which ones I can take right now, so that I can pick electives without decoding prerequisite text.
- As a student with CEGEP, AP, or IB credit, I want transfer credits and exemptions on my transcript to count toward prerequisites, so that the app does not tell me to retake courses I already have credit for.
- As a Software Engineering student, I want to upload my unofficial transcript and have every completed course saved, so that I never type them in.
- As a CS Major student, I want to see the required courses I still have left and my progress on each complementary list, so that I know what I must take before graduating.
- As a joint honours or double major student, I want both programs tracked side by side, so that I see what each one still needs.
- As a doctoral student, I want my thesis and comprehensive exam tracked as requirements met, so that a program with no credit total still shows my progress.
- As any student, I want to lay out my remaining terms and get warned when a course sits before its prerequisite or in a term it is not offered, so that my plan is actually possible.
- As a student whose program has a rule the app cannot read, I want to list the courses I use for it and mark it as checked, so that my progress is complete.
- As a student whose transcript has a line the app does not recognize, I want it flagged and editable before anything is saved, so that one bad line does not corrupt my profile.
- As a student who uploads the wrong PDF, I want a clear message that it is not a McGill unofficial transcript, so that I know what to upload instead.
- As a student on a shared computer or a new device, I want to delete my data in one click or move it with an exported file, so that my record goes only where I want.
- As a contributor, I want a documented requirement file format and a validator, so that I can fix my program in a PR.
- As a contributor, I want each catalogue refresh to arrive as a readable diff, so that I can catch crawler mistakes before they ship.

## 5. Requirements

### P0 - Must have

#### P0-1 Catalogue crawler

- Discovers courses from the `/courses/` index on coursecatalogue.mcgill.ca (10,118 links in 2026-2027) and writes the full catalogue as versioned data in the repo.
- Extracts code, title, credits, offering unit, faculty, terms offered, description, and prerequisite, corequisite, and restriction text, with D1/D2 and N1/N2 pairs as one logical course.
- Parses prerequisite text into an AND/OR tree of course codes, so `COMP 250; MATH 235 or MATH 240` becomes `COMP 250 AND (MATH 235 OR MATH 240)`, with unit tests built from real catalogue strings.
- Always keeps the raw prerequisite text, and marks a course `unparsed` when the text has conditions the tree cannot express (instructor permission, minimum grades, year standing), so the UI shows the raw text.
- Fetches only paths robots.txt allows, sends at most 2 requests per second with an identifying User-Agent that links to the repo, retries with backoff, and resumes an interrupted run.
- Produces deterministic, sorted output, so a rerun against an unchanged site gives a zero diff.
- Fails the run if the course count drops more than 2%, or more than 1% of courses lose a required field, against the last committed data.

#### P0-2 Scheduled data refresh

- A GitHub Actions workflow runs both crawlers on demand and before each registration period, and pushes a `data/crawl-*` branch with a summary of course and program changes.
- The CBC-Mcgill org blocks Actions from opening PRs, so the run summary offers a one-click PR link, and data reaches production only by merging that PR.
- `CRAWL_OFFLINE=1 pnpm crawl:programs` reparses the cached program pages, so each parser change lands with its own data PR, and an unchanged parser reproduces the data byte for byte.

#### P0-3 Course browser

- Search by code, title, or keyword across all courses, with results updating in under 100 ms per keystroke on a mid-range laptop.
- Filter by what the student can take now, their program, subject, faculty, level, and term offered.
- A course page shows every P0-1 field, prerequisites as links and as a checklist against the student's record, the courses it unlocks, and the student's status (completed, in progress, available, locked, or planned).
- Works without a profile or an account, and every course has a stable, shareable URL.
- ⌘K or Ctrl K on any page opens a search for a course or a page.

#### P0-4 Transcript import

- Parsing runs entirely in the browser, and the PDF never leaves the device and is never stored.
- Rejects files that are not PDFs (by file signature), larger than 5 MB, or longer than 20 pages, with a specific message for each.
- Extracts text only, in a Web Worker with a timeout, so a malformed PDF cannot freeze or attack the page.
- Detects a McGill unofficial transcript by the markers in section 8 and says so clearly when the file is not one.
- Discards the identity header (name, McGill ID, permanent code) and holds, strips the repeating page header and footer, and joins term blocks that break across pages.
- Reads degree, program lines, minor, credits required, previous education, and advanced standing to pre-fill the profile.
- Reads code, credits, grade, and term for every course line, including `RW` registrations with no grade, pass/fail grades, withdrawals, failures, deferred grades, transfer credits, exemptions (`EXC` or a course code with no value, no credit), and multi-term courses marked `²` or with D1/D2 and N1/N2 suffixes.
- Matches courses by code only, since transcript titles are abbreviated, and saves nothing until the student confirms a review screen where each course is matched to the catalogue and unknown lines are flagged and editable.
- A corpus of synthetic transcripts, built from real layouts with fake identities and grades, runs in CI and must pass at 100%, and real transcripts never enter the repo.

**Not yet.** The parser was built from one real Chrome print of an Engineering transcript.
Safari and Firefox prints and graduate transcripts have no real sample, and the Minerva wording for M.Sc.A., graduate certificate, and graduate diploma programs is unknown, so the student picks those programs by hand.

#### P0-5 Local profile

- Stores course records, program, second program, entry route, advanced standing, terms, plan, credit limit, checked rules, and listed courses in browser storage, with no account.
- Students can add or remove courses by hand when the import gets something wrong.
- Exports to a JSON file and imports it back, versioned with migrations (version 6) so old exports keep loading.
- One click deletes all local data.

#### P0-6 What's next

- Lists courses the student can take next term, with prerequisites met by completed and in-progress courses, offered that term, and not blocked by a restriction.
- Shows remaining required courses and progress on each complementary list, such as "6 of 12 credits", or "N of M requirements met" for a program with no credit total.
- Separates "must take" (remaining required courses) from "can take" (available complementaries and electives).
- Each requirement opens a pane listing its courses as Planned, Can take, Not open, and Counted, and the pane always agrees with the requirement's bar.
- Hovering or tabbing to earned, in progress, or planned on a bar lists the courses behind the number.
- A second program gets its own bar, labelled by the pair, such as Major and Minor, Joint honours, or Core and Breadth.

#### P0-7 Program requirements

Every program in the 2026-2027 catalogue comes from the crawler, 944 in all, 461 undergraduate and 483 graduate, doctorates included.
The five hand-written programs that override their generated files are Computer Science Major (B.Sc.), Computer Science Honours (B.Sc.), Software Engineering Major (B.Sc.), Co-op Software Engineering (B.Eng.), and Computer Engineering (B.Eng.).

- Each program is a data file in the schema of `lib/programs/types.ts`, with required groups, complementary groups of rules, total credits, catalogue year, and source URL.
- Graduate programs are marked `level: "graduate"`, a doctorate has no credit total and is tracked by requirements met, and a required group of 0-credit courses, such as a comprehensive examination, counts by courses.
- The crawler fails when a file breaks the schema or the program count drops more than 5%, and CI fails when a hand-written program names a course the catalogue lacks.
- Generated programs show a notice that their requirements were read automatically, with a link to the program page.
- The picker searches by name, degree, and faculty, lists graduate programs after undergraduate ones by faculty, and for a graduate program hides the CEGEP or U0 question and the second program.
- A transcript import picks a program only when exactly one program fits its degree and program lines.
- A profile holds one program and one second program (a minor, a second major, a joint honours component, or a B.Sc. Liberal breadth component), with the pair read from the two programs' names.
  Shared courses count for both up to the limit the catalogue states, and with no stated limit an Arts degree shares none and any other shares all.

The engine counts progress by these rules.

- A course counts toward one group only, required groups first.
- A program is met only when every group is met and its credits reach its total, if it has one.
- A range heading such as "24-33 credits" needs its lower bound and counts courses up to its top.
- When the groups cannot reach the program total, a "Program total" check carries the missing credits.
- An adviser reminder with no amount counts no course.
- Advanced standing counts toward the degree total and credited Year 0 groups, never toward an elective.

| 2026-2027 crawl | Programs fully readable | Rules kept as raw text |
|---|---|---|
| Undergraduate | 184 of 461 | 746 of 3,018 |
| Graduate | 137 of 483 | 695 of 1,599, of which 114 are the doctoral thesis check |

The raw rules are left as checks a student resolves (P0-11), by the coverage rule.
A parser shape must recur in 5 or more programs, with no page or department specific rules, and precision beats recall, since a wrong "satisfied" is worse than a raw rule.

#### P0-8 Semester planner

- Generates terms from the start term to expected graduation (Fall and Winter, Summer optional), which defaults to 2 years for a master's and 4 for a doctorate.
- Students add, move, and remove courses per term by click or keyboard, with drag and drop as an extra, never the only way.
- Warns, without blocking, when a course is placed before its prerequisites, in a term it is not offered, against a restriction, or over the credit limit (default 17, editable).
- Shows whether the whole plan satisfies the program and lists what is still missing, and "See choices" opens that requirement's pane on What's next.
- A term path shows every term to graduation, with completed, current, and planned terms looking distinct, and clicking a term opens it.

#### P0-9 Responsive and accessible

- Every screen is designed at 1280 px and stays usable down to 1024 px.
- Phone and tablet layouts work from 360 px, built with `max-lg:` and `max-md:` variants so desktop stays unchanged, with 44 px tap targets and no horizontal scroll at any width.
- Meets WCAG 2.2 AA with full keyboard use, visible focus, sufficient contrast, and animations that respect reduced motion.
- Lighthouse desktop performance is at least 90 on the browse and course pages.

**Not yet.** No Lighthouse score is on record.

#### P0-10 Open-source readiness

- README with one-command local setup, CONTRIBUTING with guides for code changes, crawler fixes, and adding a program, ARCHITECTURE for how the parts fit, and issue templates for "wrong course data" and "add my program".

#### P0-11 Rules the parser cannot read

- A rule the parser cannot read keeps its catalogue text, counts no course on its own, is never met until the student checks it, and shows as "Check this requirement" with a link to the program page.
- The student can mark it as checked and undo that, and a group of only checked rules and reminders counts as complete with its full credits.
- Under any raw rule, adviser-approval rule, or the "Replace exempted credits" group, the student can list any catalogue course, whose status still comes from the transcript and the plan.
- Listed courses count toward the group's credits first, and a listed course past the group's credits shows under "Not counted" and never moves to another group.
- With courses listed, "Mark as checked" first asks "Do these courses meet the requirement?", and the check lands only after the student confirms.
- Checks and lists are saved in the profile and its backups, keyed by program, group, stream, and rule text.

### P1 - Nice to have

- **P1-3 Visual Schedule Builder link** on course pages, What's next, and each planner term.
- **P1-4 Prerequisite chain** as the Unlocks list and a prerequisite checklist on each course page.
- **P1-7 Student ratings from mcgill.courses** on each course page, with average rating, difficulty, and review count from its public API, a link to the reviews, and no review text copied.
- **P1-8 AI advisor chat preview** at `/advisor`, which says the advisor is coming soon and calls no AI.

**Not yet.** P1-1 optional login with cloud sync (Supabase Auth and Postgres with row-level security, merging the local profile on first login), P1-2 a shareable read-only plan link, a full chain view for P1-4, P1-5 minimum-grade prerequisites from transcript grades, and P1-6 dark mode.

### Student backgrounds

McGill places students by how they arrive, and the plan has to follow.
Sources are McGill's CEGEP transfer credit page, the Faculty of Engineering transfer credit page, and the Foundation program page, checked 2026-10-08.
The app credits Year 0 groups to Quebec CEGEP students, counts lump-sum advanced standing and per-course transfer credits, treats the Science DEC courses (BIOL 111, CHEM 110 and 120, MATH 133, 139, 140, and 141, PHYS 131 and 142) as met for prerequisites, and names the credits an exemption must replace.

| Case | What McGill does | Still open |
|---|---|---|
| Quebec CEGEP graduate (DEC) | Enters U1 with up to 29 or 30 advanced standing credits. A B.Sc. or B.A. is 90 credits. Engineering Year 0 courses are credited. | Nothing |
| Course exemption without credit | The course counts as done, but its credits must be replaced. | Nothing |
| AP, IB, A-Level, French Baccalaureate, or CAPE | Up to 29 or 30 credits of advanced standing. 24 or more credits places the student in U1. | Unknown |
| Outside Quebec, from high school | Enters U0 and completes a 30-credit Foundation year, so a B.Sc. or B.A. is 120 credits. | Foundation course choices are not checked |
| CEGEP with only part of Year 0 covered | Some Year 0 courses are credited and some must still be taken. | Year 0 is credited as a whole |
| Incomplete DEC or a non-science DEC | Missing CEGEP prerequisites must be taken at McGill. | Every CEGEP student is assumed to hold a Science DEC |
| Transfer from another university | Per-course transfer credit, and at least 60 credits (or half of a B.Eng.) must be taken at McGill. | The residency rule is not checked |
| Mature student | Usually starts in U0. | Only the Foundation entry fits |
| Entered under an older catalogue year | Follows the requirements of the year they entered. | Every student uses the 2026-2027 catalogue |
| Second program | A minor, second major, joint honours component, or B.Sc. Liberal breadth component adds a second set of requirements. | A third program is not tracked |
| Graduate student | Master's programs, certificates, and diplomas state a credit total, doctorates state none. | Some graduate transcript wording is unknown (P0-4) |
| Changed program or faculty | Some earlier credits may not count toward the new program. | Not handled |
| Co-op work terms | Work terms sit between study terms. | Not handled in the planner |
| Second bachelor's degree | Reduced requirements and residency rules. | Not handled |

### P2 - Design for, do not build

- **AI advisor answers.** Catalogue and profile data stay in clean typed shapes an LLM can read later, and the P1-8 chat is the shell it plugs into.
- **Older catalogue years.** A profile follows the 2026-2027 catalogue for now, and program files carry their catalogue year, with each yearly crawl in its own folder.
- **French UI, degree audit PDF import, and workload data.** Difficulty comes from mcgill.courses (P1-7).

## 6. Success Metrics

Vercel Web Analytics counts anonymous page views, with no cookies and nothing from the profile, and no personal data or transcript content is ever sent.
The funnel events below are not built, so those rows are not measured yet.
Leading metrics cover the first registration period with analytics, and review points are 1 week after analytics went live, the end of that period, and 6 months after launch.

| Metric | Kind | Success | Stretch | Measured by |
|---|---|---|---|---|
| Imports confirmed with zero manual edits | Leading | 90% | 97% | Confirm event with edit count, not built |
| Sample transcript corpus pass rate | Leading | 100% | 100% | CI |
| Students who reach What's next after importing | Leading | 80% | 90% | Funnel events, not built |
| Weekly active users during registration | Leading | 100 | 500 | Vercel Web Analytics |
| Users returning the next registration period | Lagging | 30% | 50% | Needs a local install id (open question 3) |
| External PRs merged within 6 months | Lagging | 3 | 10 | GitHub |
| Hand-written program files from contributors within 6 months | Lagging | 1 | 4 | GitHub |
| Crawl PRs merged with no manual data fixes | Lagging | 3 of 4 | 4 of 4 | GitHub |

## 7. Engineering Foundation

The stack and commands are in `CLAUDE.md`.

| Area | Decision | Reason |
|---|---|---|
| Catalogue storage | Versioned JSON in the repo, written by a TypeScript crawler that Node 24 runs directly | Every data change is a reviewable diff, with no database and no build step. |
| Profile storage | Zustand store persisted to browser storage, with `version` and `migrate` | Local-first, and old exports migrate. |
| PDF parsing | pdf.js in a Web Worker | Text-only extraction off the main thread. |
| Tests | Vitest for `*.test.ts`, Playwright at 1280 px and 1024 px plus a Pixel 7 phone for `e2e/mobile*.e2e.ts` | Parsers and engine in units, flows as a student uses them end to end. |
| CI | GitHub Actions on every PR and push to `main`, with frozen install, lint, typecheck, unit, build, and E2E, and Dependabot for dependency updates | Nothing merges red. |
| Analytics | Vercel Web Analytics | Anonymous page views, no cookies, nothing from the profile. |
| Backend (P1) | Supabase Postgres, Auth, and row-level security | Only for P1-1, provisioned through the Vercel Marketplace. The app has no backend. |
| Hosting | Vercel, Thai's own account on the Hobby plan, at https://plan-your-degree.vercel.app | Native Next.js hosting with cached static course pages. Deploys run from `main` with the Vercel CLI. |
| Repo | One package, no monorepo | Until a second deployable exists. |

## 8. Data Sources

Checked on 2026-10-08 with direct requests unless noted.

- **Course pages.** `https://coursecatalogue.mcgill.ca/courses/<subject>-<number>`, 10,118 linked from `/courses/`, as server-rendered HTML.
- **Program pages.** Listed in `/sitemap.xml` (2,040 URLs), with undergraduate requirement tables in the `sc_courselist` class.
  Graduate pages sit under `/en/graduate/` with requirements in `#programrequirementstextcontainer` (checked 2026-10-11).
- **robots.txt.** Allows `/courses/`, program pages, and `/en/archives/`, where older catalogue years sit (checked 2026-10-11), and disallows `/archive/`, `/course-search/api/`, `/ribbit/`, `/search/`, and `/pdf/`.
- **Crawler identity.** An AWS WAF challenges generic User-Agents with HTTP 202, and a bot User-Agent in the standard `Mozilla/5.0 (compatible; Name/version; +repo-url)` format gets HTTP 200.
- **Unofficial transcript.** A browser print to PDF of Minerva's HTML page, read from one real sample on 2026-10-08.
  Its markers are the title `UNOFFICIAL Transcript`, the form name `SWFTRAN`, and the footer URL `horizon.mcgill.ca/pban1/bzsktran.P_Display_Form`.
- **mcgill.courses API.** Public read endpoints with no login and CORS open to any origin, where `GET /api/courses/COMP251` returns `avgRating`, `avgDifficulty`, and `reviewCount`.
  The code is CC0, but students write the reviews, so we show aggregates and link out.

## 9. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | Older catalogue years sit under `/en/archives/`, which robots.txt allows, but McGill's terms of use for automated access are unconfirmed. May we crawl them so a student follows the year they entered? | Thai | Blocks older years |
| 2 | Interview 5 students to validate the problem, and ask which open student backgrounds in section 5 matter most. | Thai | Non-blocking |
| 3 | Is a random local install id acceptable for measuring return rate, if Thai still wants that metric? | Thai | Non-blocking |

## 10. Timeline and Phasing

| Phase | Closed by |
|---|---|
| 0. Foundation | #1, #5, #6 |
| 1. Catalogue (P0-1, P0-2) | #7, #9, #11, #16 |
| 2. Design direction | #29 to #34, then #64 to #73 |
| 3. Browse and profile (P0-3, P0-5) | #13, #14 |
| 4. Import (P0-4) | #8, #15 |
| 5. Plan (P0-6, P0-7, P0-8) | #10, #12, #18, #19 |
| 6. Launch (P0-9, P0-10) | #20, #41, #48 |
| 7. Ratings, advisor, and CEGEP students (P1-4, P1-7, P1-8) | #24 to #27 |
| 8. Every undergraduate program | #42, #45, #99, #101 to #108, #110, #111 |
| 9. Second program | #54, #84, #85, #100 |
| 10. Phones and tablets | #89 to #96 |
| 11. Graduate programs | #112 to #118 |
| 12. Checks and course lists (P0-11) | #109, #119, #121, #122 |
| 13. Analytics and new address | #123, #124 |
