# Product Requirements Document — McGill Plan Your Degree

**Version:** 0.1 (Draft)
**Date:** February 2026
**Team:** CBC McGill 2026

---

## 1. Overview

McGill Plan Your Degree is a web application that transforms the stressful, confusing experience of McGill course planning into something visual, intuitive, and even enjoyable.

### Feasibility
This project is technically feasible as a Next.js web app — it's fundamentally a well-designed Claude wrapper with a graph visualization frontend, and both pieces have mature tooling. A focused MVP (one or two faculties) is achievable in a semester. The biggest uncertainty is data quality: McGill's course catalog must be scraped, cleaned, and structured before the AI or UI can work well. Full all-faculty coverage is a stretch goal after MVP validation.

### Top 3 Challenges
1. **Course data scraping & structuring** — McGill's site is scrapeable but inconsistent; accurate prereq chains require a robust scraper + validation.
2. **Skill tree graph rendering** — Visualizing a prerequisite DAG interactively (with zoom, pan, filtering) requires non-trivial graph layout engineering.
3. **AI recommendation quality** — Claude needs rich, structured course context to give useful (non-generic) advice without hitting token limits.

---

## 2. Problem Statement

Course planning at McGill is confusing and stressful. Students face:
- Opaque prerequisite chains that are hard to trace
- No guidance on balancing course difficulty across semesters
- No tool that connects degree requirements to career goals
- Proposed curricula (especially in Engineering) that don't reflect real student paths

The result: students make suboptimal choices, feel overwhelmed, and graduate without a clear sense of how their courses connect to their goals.

---

## 3. Target Users

**Primary:** McGill undergraduate students in CS / Software Engineering (MVP)
**Secondary:** All McGill undergraduates across faculties (post-MVP)

**User personas:**
- A first-year CS student trying to understand what COMP courses unlock what
- A U2 engineering student who wants to pivot toward ML without overloading on math
- A graduating student ensuring they've met all degree requirements

---

## 4. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Students find their path faster | Avg time to generate a 4-semester plan < 5 min |
| Recommendations are trusted | >70% of AI suggestions accepted or seriously considered |
| Engagement | Students return to update plan each semester |
| Coverage | MVP: CS/Engineering. V2: All faculties |

---

## 5. Features

### MVP (v1.0)
- [ ] **Skill tree view** — Interactive graph of courses for CS/Engineering. Grayed = locked, colored = available, checked = completed.
- [ ] **Prerequisite logic** — Courses unlock automatically when prereqs are marked complete.
- [ ] **"My completed courses" input** — User marks what they've taken so the tree updates.
- [ ] **AI chat advisor** — Claude integration via server-side API route. Understands user goals, preferences, completed courses.
- [ ] **Difficulty/workload tags** — Each course tagged with estimated weekly hours (scraped/curated).
- [ ] **Semester plan builder** — Drag courses into semesters; AI warns if workload is too heavy.
- [ ] **Manual course entry (fallback)** — If a course isn't found in the system, users can add it manually (course code, title, credits, prereqs). Custom courses appear in the skill tree and plan builder like any other course, and are stored locally.

### Post-MVP (v2.0+)
- [ ] All-faculty support (Arts, Science, Management)
- [ ] Degree audit (auto-check requirements completion)
- [ ] Peer data ("40% of ML-track students take COMP 551 in U2 Fall")
- [ ] Professor/rating integration (e.g., MyCourses or RateMyProfessor data)
- [ ] Export plan as PDF or share link

---

## 6. Technical Architecture

```
Browser (Next.js + React)
  ├── Skill Tree UI (React Flow)
  ├── Chat UI (Claude advisor)
  └── Semester Planner

Next.js API Routes (server-side)
  ├── /api/chat → Anthropic Claude API (claude-sonnet-4-6)
  ├── /api/courses → Course data queries
  └── /api/plan → Plan save/load

Data Layer
  ├── Supabase (PostgreSQL + Auth + RLS)
  │   ├── courses
  │   ├── course_prereqs
  │   ├── difficulty_tags
  │   ├── user_plans
  │   ├── plan_semesters
  │   ├── plan_semester_courses
  │   └── user_completed_courses
  └── Scraper (Node.js script → mcgill.ca/study)
```

---

## 7. Database Schema

### `courses`
Scraped and user-created custom courses share the same table.
```sql
courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,       -- e.g. "COMP 251"
  title       text NOT NULL,
  description text,
  credits     int NOT NULL,
  faculty     text,                       -- e.g. "Science", "Engineering"
  is_custom   bool NOT NULL DEFAULT false,
  created_by  uuid REFERENCES auth.users  -- null for scraped; set for user-added
)
```

### `course_prereqs`
Join table for prerequisite relationships. Handles OR logic (e.g. "COMP 206 or COMP 208") via `or_group`.
```sql
course_prereqs (
  course_id   uuid REFERENCES courses,
  prereq_id   uuid REFERENCES courses,
  or_group    int,   -- same number = alternatives (satisfy any one); null = required
  PRIMARY KEY (course_id, prereq_id)
)
```

### `difficulty_tags`
```sql
difficulty_tags (
  course_id        uuid PRIMARY KEY REFERENCES courses,
  estimated_hours  int,                        -- estimated hours per week
  difficulty_label text,                       -- "Easy" | "Medium" | "Hard"
  source           text DEFAULT 'manual'       -- "manual" | "scraped" | "crowdsourced"
)
```

### `user_plans`
A user can have multiple plans (e.g. "ML track", "Safe path").
```sql
user_plans (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users,
  name       text NOT NULL DEFAULT 'My Plan',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

### `plan_semesters`
```sql
plan_semesters (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id  uuid NOT NULL REFERENCES user_plans ON DELETE CASCADE,
  name     text NOT NULL,   -- e.g. "Fall 2026"
  position int NOT NULL     -- ordering: 1, 2, 3...
)
```

### `plan_semester_courses`
```sql
plan_semester_courses (
  semester_id  uuid REFERENCES plan_semesters ON DELETE CASCADE,
  course_id    uuid REFERENCES courses,
  PRIMARY KEY (semester_id, course_id)
)
```

### `user_completed_courses`
Tracks what a student has already taken, independent of their plan.
```sql
user_completed_courses (
  user_id    uuid REFERENCES auth.users,
  course_id  uuid REFERENCES courses,
  PRIMARY KEY (user_id, course_id)
)
```

### Authentication & Row-Level Security
Auth is handled by Supabase (`auth.users`) — supports email/password and OAuth (e.g. Google). No custom auth code needed. Each table is protected by RLS policies so users can only access their own data:
```sql
-- example for user_plans
CREATE POLICY "users can only access own plans"
  ON user_plans FOR ALL
  USING (auth.uid() = user_id);
```

---

## 8. Data Strategy

**Source:** McGill course catalog at `mcgill.ca/study`

**Scraping approach:**
- Node.js scraper targeting the course listings page per faculty
- Parse course code, title, description, credits, and prerequisite text
- Post-process prerequisite text with regex + Claude to extract structured prereq chains
- Store in a local database; refresh at start of each semester

**Difficulty/workload data:**
- Initial: manually estimated or sourced from student forums (Reddit r/mcgill)
- Future: crowdsourced from users

**Data freshness:** Scrape at start of each academic semester (Fall, Winter). Changes between semesters are minimal.

---

## 9. AI Integration (Claude)

**Model:** `claude-sonnet-4-6` (server-side, via Anthropic SDK)
**Access:** Server-side API route — users do not need their own API key

**System prompt context injected per request:**
- Student's completed courses
- Student's stated goals (e.g., "break into ML")
- Student's preferences (e.g., "avoid math-heavy courses this semester")
- Available courses (unlocked by prereqs)
- Per-course metadata: description, difficulty, credits, prereqs

**Claude's responsibilities:**
- Recommend 2-3 courses for next semester with reasoning
- Warn about workload imbalance
- Explain prerequisite chains in plain language
- Answer general questions about degree planning

**Rate limiting:** Session-based, ~20 messages/session to manage costs

---

## 10. UX Principles

- **Gamified but not gimmicky** — The skill tree metaphor is functional, not decorative
- **Progressive disclosure** — Show simple info first; details on hover/click
- **Mobile-friendly** — Students plan on phones too
- **Fast** — Skill tree renders instantly; AI response < 3 seconds perceived
- **Delightful** — Animations when courses unlock, subtle celebration when a requirement is met

---

## 11. Out of Scope (v1)

- Real-time McGill registration integration
- Official McGill endorsement or data partnership
- Graduate courses

---

## 12. Open Questions

- [ ] What is the best graph layout algorithm for the prereq DAG? (Dagre? ELK?)
- [ ] Do we curate difficulty data manually or crowdsource from the start?
- [ ] How do we handle courses with complex prereq logic (e.g., "X or Y or permission of instructor")?

---

## 13. Milestones

| Milestone | Target |
|---|---|
| Data pipeline: CS courses scraped & structured | Week 2 |
| Skill tree renders with real CS course data | Week 4 |
| Claude advisor MVP (basic chat) | Week 5 |
| Semester planner + workload warnings | Week 7 |
| Polish + user testing | Week 8–9 |
| MVP launch (CS/Engineering) | Week 10 |
