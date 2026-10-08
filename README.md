# McGill Plan Your Degree

Open-source degree planner for McGill students.
Browse every McGill course, import your unofficial transcript, see what you can and must take next, and plan your path to graduation.

Status: early development. The product spec is in [PRD.md](PRD.md).

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

## License

MIT
