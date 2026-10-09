# Contributing

Thanks for helping McGill students plan their degrees.
Small fixes are as welcome as new features.
The product spec in [PRD.md](PRD.md) is the source of truth for scope and requirements.

## Setup

You need Node 24 and pnpm 12.

```bash
nvm use
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Open http://localhost:3000.

Before you open a PR, run the full check.
CI runs the same commands.

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
```

## Code rules

- TypeScript is strict, with `noUncheckedIndexedAccess`.
- Biome handles linting and formatting.
  Run `pnpm format` to fix what it reports.
- Keep tests minimal.
  Add one small check per module, plus any test the PRD requires.
  Unit test files are `*.test.ts` and Playwright files are `e2e/*.e2e.ts`.
- Real transcripts never enter the repo, not even in tests.
  Fixtures are synthetic, with fake names and grades.
- Transcript parsing runs only in the browser, and the PDF never goes to a server.
- The MVP has no backend.
  Profile data lives in browser storage.
- The UI is desktop first.
  Design for a 1280 px window, keep it usable down to 1024 px, and avoid horizontal scroll.
- Click and keyboard must both work everywhere.
  Drag and drop is an extra, never the only way.
- Game animations respect `prefers-reduced-motion`.
- Game elements show real progress only, and each screen has one obvious primary action.
- Banned styles are cream or off-white backgrounds, italic accent words in headings, numbered "01 / 02" section labels, monospace labels, and pill-shaped buttons.

Never hand-edit files in `data/catalogue/` or `data/programs/generated/`.
The crawlers generate them, and they land through a reviewed PR.

## Fix a crawler or prerequisite parsing bug

Course data comes from the crawler in `crawler/`.
Prerequisite text is parsed into AND/OR trees by `crawler/prereq.ts`.

1. Copy the real catalogue string that parses wrongly from the course page on [coursecatalogue.mcgill.ca](https://coursecatalogue.mcgill.ca/courses/).
2. Add it to `crawler/prereq.test.ts` with the tree it should produce and whether it is `unparsed`.
3. Fix the parser until `pnpm test` passes.
4. Regenerate the data with `pnpm crawl`.
   A full crawl takes about 90 minutes and resumes if interrupted.
5. Include the data diff in your PR so reviewers can see what changed.

If the text has conditions the tree cannot express, such as instructor permission, the course stays `unparsed` and the UI shows the raw text.

## Add a program

1. Copy a file in `data/programs/` and rename it to the new program id, like `computer-science-major-bsc.json`.
2. Fill it in from the program page in the course catalogue, following `lib/programs/types.ts`.
   Record the catalogue year and the source URL.
3. Import the file in `lib/programs/index.ts` and add it to `PROGRAMS`.
4. If a transcript names the program, add a line for it to the guesses behind `guessProgram` in the same file, so import pre-fills it.
5. Run `pnpm test` to check the file against the schema and the catalogue.
   The test fails when a course code is missing from the catalogue.
6. Check the file by hand against the program page.

## Report wrong data or ask for a program

Open an issue with the "Wrong course data" or "Add my program" form.
You do not need to write code.

## Pull requests

Use the title format `type(scope): summary`, such as `fix(crawler): bind either-or groups inside and clauses`.
Common types are `feat`, `fix`, `docs`, `test`, `chore`, `ci`, and `data`.
The scope is optional.
Keep each PR to one change and describe what it changes and why.
