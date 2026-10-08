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
| `pnpm test:e2e` | End-to-end tests (Playwright, mobile and desktop) |

Run `pnpm exec playwright install chromium` once before the first E2E run.

## License

MIT
