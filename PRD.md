# McGill Plan Your Degree - Product Spec

**Status:** Draft v2 (full restart, replaces the February 2026 PRD)
**Date:** 2026-10-08
**Owner:** Thai (solo)
**License:** MIT, open source, plus one hosted web app

---

## 1. Problem Statement

McGill students plan four or more years of courses from a catalogue of about 10,100 course pages, free-text prerequisites, and program pages that are hard to read side by side.
Working out what you are allowed to take next, and what you still must take to graduate, means cross-checking your Minerva transcript, your program page, and each course's prerequisites by hand every registration period.
Mistakes surface late, as a blocked registration or a missing required course in final year.
Visual Schedule Builder handles timetables and the catalogue holds the rules, but nothing connects a student's actual record to their program and turns it into a plan.

Evidence so far is anecdotal (firsthand experience and the v1 PRD).
Validating with real students is open question 5.

---

## 2. Goals

**User goals**

1. A student goes from transcript PDF to a correct "what's next" view in under 3 minutes, with no manual course entry.
2. A student in one of the 5 MVP programs builds a plan to graduation where every prerequisite and program requirement is satisfied, in one session.
3. Students come back every registration period because planning feels like progress, not paperwork.

**Project goals**

4. The catalogue stays correct every term through one reviewed data PR per crawl, with no hand-entered course data.
5. A student in an unsupported program can add their program in a PR without help from the maintainer.

---

## 3. Non-Goals

| Non-goal | Why it is out |
|---|---|
| AI course advisor | Needs trustworthy course data first. Revisit once the catalogue and planner are solid (P2). |
| Timetables and section times | Visual Schedule Builder already does this. We link to it instead (P1). |
| Registering for courses or touching Minerva | No public API, and acting on a student's account is a liability. |
| Requirement tracking beyond the 5 MVP programs | Each program needs hand verification. More programs come from contributors. |
| Degree audit PDF import | The transcript already gives completed courses. A second parser adds little for the MVP. |
| Mobile layouts, native apps, and French UI | Students plan at a desk during registration, so the MVP is desktop-only. Mobile and French come after launch. |

---

## 4. User Stories

### New student (U0 or U1)

- As a new CS student, I want to browse every McGill course and see which ones I can take right now, so that I can pick electives without decoding prerequisite text.
- As a student with CEGEP, AP, or IB credit, I want transfer credits and exemptions on my transcript to count toward prerequisites, so that the app does not tell me to retake courses I already have credit for.

### Mid-degree student (U2 or U3)

- As a Software Engineering student, I want to upload my unofficial transcript and have every completed course saved, so that I never type them in.
- As a CS Major student, I want to see the required courses I still have left and my progress on each complementary list, so that I know what I must take before graduating.
- As any student, I want to lay out my remaining terms and get warned when a course sits before its prerequisite or in a term it is not offered, so that my plan is actually possible.
- As any student, I want my progress shown as XP, levels, badges, and a path to graduation, so that planning feels rewarding.

### Edge cases

- As a student with a withdrawn or failed course, I want it excluded from my completed courses, so that what shows as unlocked is accurate.
- As a student whose transcript has a line the app does not recognize, I want it flagged and editable before anything is saved, so that one bad line does not corrupt my profile.
- As a student who uploads the wrong PDF, I want a clear message that it is not a McGill unofficial transcript, so that I know what to upload instead.
- As a student on a shared computer, I want to delete all my data in one click, so that my record does not stay in the browser.
- As a student switching devices without an account, I want to export my profile to a file and import it elsewhere, so that I keep my plan.

### Contributor

- As a student developer in an unsupported program, I want a documented requirement file format and a validator, so that I can add my program in a PR.
- As a contributor, I want each catalogue refresh to arrive as a readable diff, so that I can catch crawler mistakes before they ship.

---

## 5. Requirements

### P0 - Must have

#### P0-1 Catalogue crawler

Crawls every course page on coursecatalogue.mcgill.ca and writes the full catalogue as versioned data in the repo.

- [ ] Discovers courses from the `/courses/` index (10,118 links in the 2026-27 catalogue) and fetches each `/courses/<subject>-<number>` page.
- [ ] Extracts code, title, credits, offering unit, faculty, terms offered, description, prerequisite text, corequisite text, and restriction text.
- [ ] Parses prerequisite text into an AND/OR tree of course codes, for example `COMP 250; MATH 235 or MATH 240` becomes `COMP 250 AND (MATH 235 OR MATH 240)`.
- [ ] Always keeps the raw prerequisite text. Marks a course `unparsed` when the text has conditions the tree cannot express (instructor permission, minimum grades, year standing), and the UI shows the raw text for those.
- [ ] Handles multi-term courses (D1/D2 and N1/N2 pairs) as one logical course.
- [ ] Fetches only paths that robots.txt allows. Does not use `/course-search/api/` or `/ribbit/`, which are disallowed.
- [ ] Sends at most 2 requests per second with an identifying User-Agent that links to the repo, retries with backoff, and can resume an interrupted run.
- [ ] Produces deterministic, sorted output, so a rerun against an unchanged site gives a zero diff.
- [ ] Fails the run if the course count drops more than 2%, or more than 1% of courses lose a required field, compared to the last committed data.
- [ ] The prerequisite parser has unit tests built from real catalogue strings.

#### P0-2 Scheduled data refresh

- [ ] A GitHub Actions workflow runs the crawler on demand and on a schedule before each registration period.
- [ ] It pushes a data branch and offers a one-click PR link with a summary of added, removed, and changed courses. The CBC-Mcgill org blocks Actions from opening PRs itself, so it opens one only if an org admin allows that.
- [ ] Catalogue data reaches production only by merging that PR.

#### P0-3 Course browser

- [ ] Search by code, title, or keyword across all courses, with results updating in under 100 ms per keystroke on a mid-range laptop.
- [ ] Filter by subject, faculty, level, term offered, and "available to me".
- [ ] A course page shows every P0-1 field, prerequisites as clickable links, and the student's status for that course: completed, in progress, available, locked, or planned.
- [ ] Works without a profile (status hidden) and without an account.
- [ ] Every course has a stable, shareable URL.

#### P0-4 Transcript import (safe parser)

- [ ] Parsing runs entirely in the browser. The PDF never leaves the device and is never stored.
- [ ] Rejects files that are not PDFs (checked by file signature, not extension), larger than 5 MB, or longer than 20 pages, with a specific message for each.
- [ ] Extracts text only, in a Web Worker with a timeout. No scripts, forms, or embedded files are run or rendered, so a malformed PDF cannot freeze or attack the page.
- [ ] Detects whether the file is a McGill unofficial transcript (markers in section 8) and says so clearly when it is not.
- [ ] Discards the identity header (name, McGill ID, permanent code) and holds. They are never stored or shown again.
- [ ] Strips the repeating browser page header and footer, and joins term blocks that break across pages.
- [ ] Reads program, minor, and credits required, and pre-fills them in the profile.
- [ ] Extracts course code, credits, grade, and term for every line, including registered courses with no grade yet (`RW`), pass/fail grades, withdrawals, failing grades, deferred grades, transfer credits, and exemptions (`EXC`, no credit).
- [ ] Handles multi-term courses marked with `²` and suffixes such as D1/D2 and N1/N2.
- [ ] Matches courses by code only, since transcript titles are abbreviated.
- [ ] Shows a review screen before saving: each course matched to the catalogue, unknown lines flagged and editable, and nothing saved until the student confirms.
- [ ] A corpus of synthetic transcripts, built from real layouts with fake identities and grades, runs in CI and must pass at 100%. Real transcripts never enter the repo.

#### P0-5 Local profile

- [ ] Stores completed and in-progress courses, program, start term, and plan in browser storage, with no account.
- [ ] Students can add or remove courses by hand when the import gets something wrong.
- [ ] Export to a JSON file and import it back. The schema is versioned with migrations, so old exports keep loading.
- [ ] One click deletes all local data.

#### P0-6 What's next

- [ ] Lists courses the student can take next term: prerequisites met by completed and in-progress courses, offered that term, and not blocked by a restriction.
- [ ] For the 5 MVP programs, shows remaining required courses and progress on each complementary list, for example "6 of 12 credits".
- [ ] Separates "must take" (remaining required courses) from "can take" (available complementaries and electives).

#### P0-7 Program requirements for 5 programs

Programs: Computer Science Major (B.Sc.), Computer Science Honours (B.Sc.), Software Engineering Major (B.Sc.), Co-op Software Engineering (B.Eng.), Computer Engineering (B.Eng.).

- [ ] Each program is a data file in a documented schema with required courses, complementary lists with credit or course counts, and total credits.
- [ ] Each file is seeded from the program page's course list tables, then checked by hand against that page, and records its catalogue year and source URL.
- [ ] A validator runs in CI and fails if any course code in a program file is missing from the catalogue.

#### P0-8 Semester planner

- [ ] Generates terms from the student's start term to expected graduation (Fall and Winter, Summer optional).
- [ ] Students add, move, and remove courses per term by click or keyboard. Drag and drop is an extra, never the only way.
- [ ] Warns, without blocking, when a course is placed before its prerequisites, in a term it is not offered, against a restriction, or in a term over a credit limit (default 17, editable).
- [ ] Shows whether the whole plan satisfies the program, and lists what is still missing.

#### P0-9 Gamified progress

- [ ] XP comes from completed credits only. Planned courses show potential XP but do not award it.
- [ ] Levels follow McGill year standing (U0 to U4) with sub-levels between years.
- [ ] Badges mark real milestones, such as first import, finishing a required block, finishing a complementary list, a fully valid plan, and graduation-ready. The MVP ships at least 10 badges.
- [ ] The quest path shows every term from start to graduation as a stage on one path. Completed, current, and planned stages look distinct, and clicking a stage opens that term.
- [ ] Every game element reflects real academic progress. No streaks, timers, or rewards for opening the app.

#### P0-10 Desktop-first and accessible

- [ ] Every screen is designed for a 1280 px wide window and stays usable down to 1024 px. Mobile layouts are out of scope for the MVP.
- [ ] Meets WCAG 2.2 AA: full keyboard use, visible focus, sufficient contrast, and game animations respect reduced motion.
- [ ] Lighthouse desktop performance is at least 90 on the browse and course pages.

#### P0-11 Open-source readiness

- [ ] README with one-command local setup.
- [ ] CONTRIBUTING with guides for code changes, crawler fixes, and adding a program.
- [ ] Issue templates for "wrong course data" and "add my program".

### P1 - Nice to have

- **P1-1 Optional login with cloud sync.** Built on Supabase Auth and Postgres with row-level security. The local profile merges into the account on first login.
- **P1-2 Shareable read-only plan link.**
- **P1-3 Visual Schedule Builder link** per course and term, as the catalogue already offers.
- **P1-4 Prerequisite chain view** on each course page, showing what it needs and what it unlocks.
- **P1-5 Minimum-grade prerequisites** enforced using transcript grades.
- **P1-6 Dark mode.**

### P2 - Design for, do not build

- **AI advisor.** Keep catalogue and profile data in clean typed shapes that an LLM can read later.
- **All programs, minors, and multiple catalogue years.** Program files carry their catalogue year from day one.
- **French UI.**
- **Degree audit PDF import.**
- **Workload and difficulty data.**

---

## 6. Success Metrics

The MVP ships without analytics. Usage metrics start once privacy-friendly analytics is added after launch (open question 4), and no personal data or transcript content is ever sent.

### Leading (first registration period after launch)

| Metric | Success | Stretch | Measured by |
|---|---|---|---|
| Imports confirmed with zero manual edits | 90% | 97% | Anonymous event on confirm, with edit count |
| Sample transcript corpus pass rate | 100% | 100% | CI |
| Students who reach "what's next" after importing | 80% | 90% | Funnel events |
| Weekly active users during registration | 100 | 500 | Analytics |

### Lagging

| Metric | Success | Stretch | Measured by |
|---|---|---|---|
| Users returning the next registration period | 30% | 50% | Analytics (see open question 4) |
| External PRs merged within 6 months | 3 | 10 | GitHub |
| Programs added by contributors within 6 months | 1 | 4 | GitHub |
| Crawl PRs merged with no manual data fixes | 3 of 4 | 4 of 4 | GitHub |

Review points: 1 week after launch, end of the first registration period, and 6 months after launch.

---

## 7. Engineering Foundation

| Area | Decision | Reason |
|---|---|---|
| Runtime | Node 24 LTS (24.21), pinned in `.nvmrc` and `engines` | Current LTS and Vercel default. Move to Node 26 once it reaches LTS (late Oct 2026). |
| Package manager | pnpm 12 (12.10), pinned in `packageManager` | Strict dependency resolution, fast installs, one lockfile. |
| Framework | Next.js 16 App Router, React 19 | Static course pages plus client-heavy planner in one app. |
| Language | TypeScript strict, with `noUncheckedIndexedAccess` | Catches missing-course and empty-array bugs at compile time. |
| Styling | Tailwind CSS v4 | Utility classes, no runtime cost. |
| Components | shadcn/ui, restyled for a game look | Accessible primitives copied into the repo, so the look is fully ours. |
| Animation | Motion | Unlock, XP, and level-up animations, with reduced-motion support. |
| Lint and format | Biome | One fast tool replaces ESLint and Prettier. |
| Unit tests | Vitest | Prerequisite parser, transcript parser, requirement engine. |
| E2E tests | Playwright, desktop viewport | Import, browse, and plan flows as a student uses them. |
| Crawler | TypeScript script in the same repo, run by Node 24 directly | Native type stripping, no extra build step. |
| Catalogue storage | Versioned JSON in the repo | Every change is a reviewable diff. No database needed to browse. |
| Profile storage | Zustand store persisted to browser storage, with `version` and `migrate` | Local-first. Built-in schema versioning covers P0-5 migrations. |
| Backend (P1) | Supabase: Postgres, Auth, row-level security | Login and cloud sync for P1-1. Provisioned through the Vercel Marketplace when P1 starts. The MVP needs no backend. |
| PDF parsing | pdf.js in a Web Worker | Mature, text-only extraction, runs off the main thread. |
| CI | GitHub Actions on every PR: frozen install, lint, typecheck, unit, build, E2E | Nothing merges red. |
| Dependency updates | Dependabot | Built into GitHub. |
| Hosting | Vercel, personal scope | Native Next.js hosting. Course pages are cached static files, so no server of our own runs. |

One package, no monorepo, until a second deployable exists.

---

## 8. Data Sources

Checked on 2026-10-08 with direct requests.

- **Course pages:** `https://coursecatalogue.mcgill.ca/courses/<subject>-<number>`, 10,118 linked from `/courses/`. Server-rendered HTML. The COMP 251 page shows credits, offering unit, terms offered (Fall 2026, Winter 2027), description, prerequisites, and restrictions.
- **Program pages:** listed in `/sitemap.xml` (2,040 URLs). Requirement tables use the `sc_courselist` class with code, title, and credit columns.
- **Crawler identity:** an AWS WAF challenges generic User-Agents with HTTP 202. A bot User-Agent in the standard `Mozilla/5.0 (compatible; Name/version; +repo-url)` format gets HTTP 200.
- **robots.txt:** allows `/courses/` and program pages. Disallows `/course-search/api/`, `/ribbit/`, `/search/`, and `/pdf/`.
- **Old eCalendar (`mcgill.ca/study`):** returned HTTP 403 to a script. Not used.
- **Unofficial transcript** (one real sample, read 2026-10-08): a browser print to PDF of Minerva's HTML page, so the text layout depends on the browser that printed it. Markers: the title `UNOFFICIAL Transcript`, form name `SWFTRAN`, and the footer URL `horizon.mcgill.ca/pban1/bzsktran.P_Display_Form`. Each term block lists degree, year, program, and minor, then rows of subject, number, section, abbreviated title, credits, grade, remarks, earned credits, and class average. Registered future courses start with `RW` and have no grade. A legend defines remarks I, E, and A, `*` for credits not counted, and `²` for multi-term courses.
- **Not confirmed:** McGill's terms of use for automated access (not checked).

---

## 9. Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | One real transcript is in hand (Chrome print, Engineering). Still needed: Safari and Firefox prints, a Science student, and records with transfer course credits, withdrawals, failures, and deferred grades. | Thai | Non-blocking, synthetic fixtures cover gaps |
| 2 | Do McGill's terms of use allow crawling the catalogue? Should we notify McGill before launch? | Thai, legal | Blocks public launch, not development |
| 3 | Students follow the requirements of the catalogue year they entered. The MVP assumes the current year for everyone. Is that acceptable for launch? | Thai | Non-blocking |
| 4 | Analytics tool after launch, and whether a random local install ID is acceptable for measuring return rate. | Engineering | Non-blocking |
| 5 | Interview 5 students to validate the problem and the game style before the design pass. | Thai | Non-blocking |
| 6 | Visual direction for the quest path, XP, levels, and badges (superdesign exploration). | Design | Blocks P0-9 build only |

---

## 10. Timeline and Phasing

Solo, no hard deadline.
Registration periods are natural launch moments.
Estimates are rough and count focused working days.

| Phase | Scope | Estimate |
|---|---|---|
| 0. Foundation | Remove old code, scaffold with the stack in section 7, CI green, new CLAUDE.md | 1 day |
| 1. Catalogue | Crawler, prerequisite parser, data PR workflow (P0-1, P0-2) | 1 to 2 weeks, the riskiest phase |
| 2. Design direction | Superdesign exploration for the gamified UI, run in parallel with phase 1 | 2 to 3 days |
| 3. Browse and profile | Course browser and local profile (P0-3, P0-5) | 1 week |
| 4. Import | Transcript parser and review screen (P0-4), starts once samples exist | 1 week |
| 5. Plan | Program files, what's next, semester planner (P0-6, P0-7, P0-8) | 2 weeks |
| 6. Game and launch | XP, levels, badges, quest path, accessibility and performance pass (P0-9 to P0-11) | 1 to 2 weeks |

Total: about 7 to 10 focused weeks.
