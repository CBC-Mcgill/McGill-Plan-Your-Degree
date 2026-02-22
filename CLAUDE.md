# CLAUDE.md — McGill Plan Your Degree

## What is this project?
A Next.js web app that lets McGill students visualize their degree as an interactive skill tree,
plan semesters, and get AI-powered course recommendations via Claude. MVP targets CS/Engineering.

## Tech Stack
| Layer              | Technology                                      |
|--------------------|-------------------------------------------------|
| Framework          | Next.js 14+ (App Router)                        |
| Language           | TypeScript (strict mode)                        |
| Styling            | Tailwind CSS                                    |
| Graph / Skill Tree | React Flow                                      |
| AI                 | Anthropic Claude API (`claude-sonnet-4-6`)      |
| Database / Auth    | Supabase (PostgreSQL + Auth + RLS)              |
| Scraper            | Node.js script (targets mcgill.ca/study)        |

## Key Commands
```bash
npm run dev       # start dev server (localhost:3000)
npm run build     # production build
npm run scrape    # run McGill course scraper (populates Supabase)
```

## Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never expose to client
ANTHROPIC_API_KEY=               # server-side only, never expose to client
```

## Database Schema (Supabase / PostgreSQL)

### `courses`
| column      | type    | notes                                   |
|-------------|---------|-----------------------------------------|
| id          | uuid PK |                                         |
| code        | text    | unique, e.g. "COMP 251"                 |
| title       | text    |                                         |
| description | text    |                                         |
| credits     | int     |                                         |
| faculty     | text    | e.g. "Science", "Engineering"           |
| is_custom   | bool    | false = scraped; true = user-added      |
| created_by  | uuid FK | references auth.users; null for scraped |

### `course_prereqs`
| column    | type    | notes                                          |
|-----------|---------|------------------------------------------------|
| course_id | uuid FK |                                                |
| prereq_id | uuid FK |                                                |
| or_group  | int     | same number = OR alternatives; null = required |

### `difficulty_tags`
| column           | type       | notes                                                        |
|------------------|------------|--------------------------------------------------------------|
| id               | uuid PK    |                                                              |
| course_id        | uuid FK    |                                                              |
| professor        | text       | nullable; null = course-wide rating, non-null = professor-specific |
| estimated_hours  | int        | hours per week                                               |
| difficulty_label | text       | "Easy" / "Medium" / "Hard"                                   |
| source           | text       | "manual" / "scraped" / "crowdsourced"                        |

Unique constraint on `(course_id, professor)`.

### `user_plans`
| column     | type        | notes                 |
|------------|-------------|-----------------------|
| id         | uuid PK     |                       |
| user_id    | uuid FK     | references auth.users |
| name       | text        | e.g. "My CS Plan"     |
| created_at | timestamptz |                       |
| updated_at | timestamptz |                       |

### `plan_semesters`
| column   | type    | notes                |
|----------|---------|----------------------|
| id       | uuid PK |                      |
| plan_id  | uuid FK | cascade delete       |
| name     | text    | e.g. "Fall 2026"     |
| position | int     | ordering index       |

### `plan_semester_courses`
| column      | type    | notes          |
|-------------|---------|----------------|
| semester_id | uuid FK | cascade delete |
| course_id   | uuid FK |                |

### `user_completed_courses`
| column    | type    | notes                 |
|-----------|---------|-----------------------|
| user_id   | uuid FK | references auth.users |
| course_id | uuid FK |                       |

## Intended Project Structure
```
/app                  # Next.js App Router pages & layouts
  /api
    /chat             # Claude API route (server-side only)
    /courses          # Course data queries
    /plan             # Plan save/load
/components
  /skill-tree         # React Flow graph components
  /chat               # Claude chat UI
  /planner            # Semester drag-and-drop planner
/lib
  /supabase.ts        # Supabase client (browser + server)
  /anthropic.ts       # Anthropic client (server-side only)
  /types.ts           # Shared TypeScript types
/scripts
  /scraper.ts         # McGill course scraper
/supabase
  /migrations         # SQL migration files
```

## Hard Rules (always follow these)
- **Never** import or use `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in any file
  inside `/app` that doesn't have `'use server'` or isn't inside `/app/api/`
- **All Claude API calls** go through `/app/api/chat/route.ts` only — never call Anthropic
  directly from client components
- **Supabase browser client** uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` + RLS. The service role
  key is only used in server routes and scripts.
- Always write **TypeScript** — no `.js` files in `/app`, `/components`, or `/lib`
- Prefer the **Supabase client library** over raw SQL for CRUD operations
- Custom (user-added) courses always have `is_custom = true` and a `created_by` set

## Frontend / UI Rules (always follow these)
- **Mobile-first, always**: every component and page must be usable and visually clear on
  mobile (≥ 320px) as well as desktop. Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
  to adapt layouts — never assume a wide viewport.
- Default layout pattern: single-column stack on mobile → multi-column grid/flex on desktop.
- Touch targets must be at least 44×44 px (use `min-h-11 min-w-11` or equivalent).
- Avoid fixed pixel widths that break on small screens; prefer `w-full`, `max-w-*`, and
  percentage-based sizing.
- The skill-tree (React Flow) must degrade gracefully on mobile: pan/zoom via touch, and a
  simplified list-view fallback if the graph is too dense to navigate on a small screen.

## Key Reference Docs
- PRD: `PRD.md` — full product requirements and milestones
- README: `README.md` — developer setup guide
