# McGill Plan Your Degree

Open-source degree planner for McGill students.
Import your unofficial transcript, see which courses you can take next, and plan every term up to graduation.
Plan Your Degree is not affiliated with McGill University.

## Features

- Browse every McGill course, with search, filters, and a shareable page for each course.
- Import your unofficial transcript privately, and review it before anything is saved.
- See what's next: the courses you can take next term and the required ones you still need.
- Plan each term on a quest path, with warnings for missing prerequisites, terms a course is not offered, and credit overloads.
- Earn XP and badges from real progress, with a new level for every 15 credits.

## Privacy

Everything stays in your browser.
The transcript is read on your device and is never uploaded, and the PDF is never stored.
The app has no accounts and no backend.
Export your data as a file or delete all of it from the profile page at any time.

## Setup

Requires Node 24 and pnpm 12.

```bash
nvm use
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Lint and format check (Biome) |
| `pnpm format` | Fix lint and formatting |
| `pnpm typecheck` | Generate route types and run `tsc` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright, desktop) |
| `pnpm crawl` | Crawl the course catalogue into `data/catalogue/` |

Run `pnpm exec playwright install chromium` once before the first E2E run.

## Course catalogue

`pnpm crawl` reads every course page on [coursecatalogue.mcgill.ca](https://coursecatalogue.mcgill.ca/courses/) and writes one JSON file per subject to `data/catalogue/courses/`.
It sends at most 2 requests per second, follows robots.txt, and caches pages in `.cache/catalogue/` for a day, so an interrupted run resumes where it stopped.
A full crawl takes about 90 minutes.
The run fails instead of writing data when the course count drops more than 2% or more than 1% of courses lose a required field.
Prerequisites are parsed into AND/OR trees of course codes, and the raw text is always kept.
Text with conditions the tree cannot express, such as instructor permission, is marked `unparsed`.
Never edit files in `data/catalogue/` by hand.

The `Crawl catalogue` GitHub Actions workflow runs the crawler on demand and before each registration period.
When the data changed, it pushes a `data/catalogue-*` branch and opens a PR with a summary of added, removed, and changed courses.
The CBC-Mcgill organization blocks Actions from opening PRs, so the run summary shows a one-click link to open it instead.
Catalogue data reaches production only by merging that PR.

## Contributing

Fixes and new programs are welcome.
Read [CONTRIBUTING.md](CONTRIBUTING.md) for the code rules, how to fix crawler bugs, and how to add a program.
The product spec is in [PRD.md](PRD.md).

## License

MIT
