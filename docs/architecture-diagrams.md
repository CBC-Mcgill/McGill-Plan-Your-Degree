# Architecture diagrams

These diagrams show how Plan Your Degree fits together, from the outside services down to the planner.
Read [ARCHITECTURE.md](../ARCHITECTURE.md) for the full explanation, and [PRD.md](../PRD.md) for scope and requirements.

## System context

Who and what the project touches: people, McGill, mcgill.courses, GitHub, Vercel and the browser.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 25, "rankSpacing": 40}}}%%
flowchart TB
  student(["Student"])
  maintainer(["Maintainer or contributor"])

  subgraph browser["Student's browser"]
    app["Next.js app"]
    worker["Web Worker with pdf.js"]
    local[("localStorage<br/>profile")]
  end

  subgraph outside["Outside services"]
    minerva["Minerva<br/>unofficial transcript"]
    catalogue["McGill Course<br/>Catalogue"]
    ratings["mcgill.courses<br/>ratings API"]
  end

  subgraph github["GitHub repository"]
    actions["GitHub Actions<br/>crawl.yml and ci.yml"]
    prs["Pull requests<br/>data/crawl-* branches"]
    main["main branch<br/>code and data"]
  end

  vercel["Vercel<br/>pages and static JSON"]

  student -->|"prints PDF"| minerva
  student -->|"picks the PDF"| app
  app -->|"file"| worker
  worker -->|"courses"| app
  app <-->|"profile"| local
  app -->|"course code only"| ratings
  vercel -->|"pages and JSON"| app

  actions -->|"polite crawl"| catalogue
  actions -->|"pushes data branch"| prs
  maintainer -->|"reviews, merges"| prs
  prs -->|"merge"| main
  maintainer -->|"deploys by hand"| vercel
  main -->|"vercel deploy"| vercel
```

## The scheduled crawl job

What happens from the cron trigger or a manual run to a merged data PR and a live deploy.

```mermaid
%%{init: {"sequence": {"width": 120, "actorMargin": 25, "messageMargin": 28, "wrap": true}}}%%
sequenceDiagram
  autonumber
  actor Maint as Maintainer
  participant Cron as GitHub cron
  participant Job as crawl.yml job
  participant McGill as McGill catalogue
  participant Repo as GitHub repo
  actor Rev as Reviewer
  participant Vercel

  alt Scheduled
    Cron->>Job: 09:00 UTC on 15 Mar, 15 Apr, 1 Aug, 1 Dec
  else Manual
    Maint->>Job: Run workflow in the Actions tab
  end
  Job->>Job: checkout and install
  Job->>McGill: pnpm crawl reads robots.txt and every course page
  Note over Job,McGill: bot User-Agent, 2 requests per second, 24 hour cache
  McGill-->>Job: HTML
  Job->>Job: parse, merge parts, check guardrails
  alt count drops over 2 percent or over 1 percent lose a field
    Job-->>Maint: run fails, nothing written
  else guardrails pass
    Job->>Job: write data/catalogue and a summary
  end
  Job->>McGill: pnpm crawl:programs reads sitemap and program pages
  McGill-->>Job: HTML
  Job->>Job: parse, validate, check guardrails, write the program files
  alt no change under data
    Job-->>Maint: summary says no changes
  else data changed
    Job->>Repo: push data/crawl-DATE-RUNID
    Job->>Repo: gh pr create
    alt Actions may open PRs
      Repo-->>Rev: PR with the summary
    else organization blocks it
      Job-->>Rev: compare link in the run summary
      Rev->>Repo: open the PR from the link
    end
    Rev->>Repo: read the diff and summary, merge to main
    Rev->>Vercel: vercel deploy --prod from main
    Vercel-->>Rev: new build with the new data
  end
```

## The data pipeline

How a catalogue page becomes JSON in the repo, then static routes, then a cache in the browser.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 20, "rankSpacing": 40}}}%%
flowchart TB
  subgraph mcgill["coursecatalogue.mcgill.ca"]
    pages["Course pages and<br/>program pages"]
  end

  subgraph crawler["crawler/"]
    fetch["fetch.ts<br/>UA, 2 per second, cache"]
    parse["parse-course.ts, prereq.ts,<br/>merge.ts, parse-program.ts"]
    guards["compare.ts and<br/>compare-programs.ts<br/>guardrails and summaries"]
  end

  subgraph data["data/ in the repo, merged by reviewed PR"]
    cjson["catalogue/courses/<br/>SUBJECT.json, meta.json"]
    gjson["programs/generated/<br/>YEAR/ID.json, index.json"]
    hjson["programs/*.json<br/>hand-written"]
  end

  subgraph vercel["Next.js app on Vercel"]
    loaders["lib/catalogue/server.ts<br/>lib/programs/server.ts"]
    catjson["/catalogue.json"]
    proglist["/programs.json"]
    progid["/programs/ID"]
    coursepage["/courses/SLUG<br/>rendered on first visit"]
  end

  subgraph browser["Browser"]
    caches["client.ts module caches"]
    hooks["useCatalogue, useProgramIndex,<br/>useProgram"]
  end

  pages --> fetch --> parse --> guards
  guards --> cjson
  guards --> gjson
  cjson -.->|"subject lookup"| parse
  cjson --> loaders
  gjson --> loaders
  hjson -->|"replaces the same id"| loaders
  loaders --> catjson
  loaders --> proglist
  loaders --> progid
  loaders --> coursepage
  catjson -->|"fetched once"| caches
  proglist -->|"on first ask"| caches
  progid -->|"once per id"| caches
  caches --> hooks
```

## The client runtime

Which layers the screens use, and where the profile and the catalogue live in the browser.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 15, "rankSpacing": 45}}}%%
flowchart LR
  subgraph screens["Screens"]
    home["Home"]
    next["WhatsNext"]
    planner["Planner"]
    browse["CourseBrowser"]
    coursepage["Course page<br/>client parts"]
    palette["CommandPalette"]
    profile["Profile and<br/>import review"]
  end

  subgraph engine["lib/engine, pure functions"]
    nextview["next-view.ts"]
    progress["progress.ts"]
    planstages["plan.ts<br/>stages.ts"]
    status["status.ts"]
    browsemod["browse.ts"]
    snapshot["snapshot.ts"]
  end

  subgraph hooks["Shared hooks"]
    usestore["useProfileStore"]
    usesnap["useSnapshot"]
    usecat["useCatalogue"]
    useprog["useProgram and<br/>useProgramIndex"]
  end

  subgraph state["Browser state"]
    store["Zustand profile store"]
    ls[("localStorage<br/>plan-your-degree:profile")]
    caches["Module caches"]
  end

  net["Static JSON<br/>catalogue.json, programs.json,<br/>programs/ID"]

  screens ==>|"read data"| hooks
  home -.-> nextview
  home -.-> progress
  home -.-> planstages
  next -.-> nextview
  planner -.-> planstages
  planner -.-> progress
  browse -.-> status
  browse -.-> browsemod
  coursepage -.-> status
  coursepage -.-> planstages
  palette -.-> status
  profile -.-> snapshot

  usestore --> store
  usesnap --> store
  usesnap -->|"buildSnapshot"| snapshot
  usecat --> caches
  useprog --> caches
  store <--> ls
  caches -->|"fetch once"| net
```

Every screen reads the profile through `useProfileStore`.
This table shows the rest.

| Screen | Hooks | Engine calls |
|---|---|---|
| Home | `useSnapshot`, `useCatalogue`, `useProgram` | `nextView`, `programProgress`, `buildStages` |
| WhatsNext | `useSnapshot`, `useCatalogue`, `useProgram` | `nextView` |
| Planner | `useSnapshot`, `useCatalogue`, `useProgram` | `planWarnings`, `buildStages`, `programProgress` |
| CourseBrowser | `useSnapshot`, `useCatalogue`, `useProgram` | `courseStatus`, `browse.ts` helpers |
| Course page, client parts | `useSnapshot` | `courseStatus`, `isOffered`, `courseLoads` |
| CommandPalette | `useSnapshot`, `useCatalogue` | `courseStatus` |
| Profile and import review | `useCatalogue`, `useProgram`, `useProgramIndex` | `buildSnapshot` |

## The transcript import

How a PDF becomes saved courses while the file stays on the student's device.

```mermaid
%%{init: {"sequence": {"width": 120, "actorMargin": 20, "messageMargin": 28, "wrap": true}}}%%
sequenceDiagram
  autonumber
  actor Student
  participant Screen as ImportScreen
  participant Client as client.ts
  participant Worker as Web Worker with pdf.js
  participant Parser as parse.ts
  participant Review as ReviewScreen
  participant Store as Zustand store and localStorage

  Student->>Screen: choose or drop the PDF
  Screen->>Client: readTranscriptFile(file)
  Client->>Worker: postMessage(file), start a 15 second timer
  Note over Client,Worker: the file stays on this device
  Worker->>Worker: check %PDF- signature, 5 MB and 20 pages
  Worker->>Worker: extract text only, rebuild lines and cells
  Worker->>Parser: parseTranscript(lines)
  Parser->>Parser: need 2 of 3 Minerva markers
  Parser->>Parser: skip identity and holds, strip page header and footer
  Parser->>Parser: read terms, courses, grades, advanced standing
  Parser-->>Worker: Transcript, or null if not a transcript
  Worker-->>Client: result or a specific error
  Client->>Client: terminate the worker, clear the timer
  Client-->>Screen: error message, or the transcript
  Screen->>Review: show the review screen
  Review->>Review: guess the program, flag courses not in the catalogue
  Student->>Review: fix program and terms, remove courses
  Student->>Review: Save to my profile
  Review->>Store: applyTranscript, setProgram, setBackground, setTerms
  Store-->>Student: saved, go to What's next
  Note over Store: the PDF is never stored
```

## The planner data flow

How a plan stored in start terms becomes loads, warnings, a term path and a term panel, with ECSE 458 as the example.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 20, "rankSpacing": 40}}}%%
flowchart TB
  plan["plan in the store<br/>ECSE 458 under Fall 2026,<br/>its start term"]
  profile["records, startTerm,<br/>graduationTerm, creditLimit,<br/>entry"]
  catalogue["Catalogue<br/>ECSE 458 has parts<br/>D1, D2, N1, N2"]

  loads["planLoads<br/>D route, because D1 runs in Fall:<br/>D1 in Fall 2026, 3 credits<br/>D2 in Winter 2027, 3 credits"]
  snapshot["useSnapshot<br/>buildSnapshot"]
  warnings["planWarnings<br/>prerequisite, offering, restriction,<br/>credit limit, graduation, missing part"]
  stages["buildStages<br/>one stage per term"]
  progress["programProgress"]

  subgraph screen["Planner screen"]
    summary["PlanSummary"]
    path["TermPath"]
    panel["TermPanel"]
    termwarn["TermWarnings"]
    addcourse["AddCourse"]
  end

  plan --> loads
  catalogue --> loads
  plan --> snapshot
  profile --> snapshot
  loads --> warnings
  snapshot --> warnings
  profile --> warnings
  loads --> stages
  profile --> stages
  warnings --> stages
  snapshot --> progress
  warnings -->|"count"| summary
  progress --> summary
  stages --> path
  path -->|"select a term"| panel
  stages --> panel
  panel --> termwarn
  panel --> addcourse
  panel -->|"move, remove"| plan
  addcourse -->|"addWithUndo"| plan
```

## CI and deployment

How a change goes from a pull request to the live site.

```mermaid
%%{init: {"flowchart": {"nodeSpacing": 25, "rankSpacing": 30}}}%%
flowchart TB
  change["Pull request<br/>code change, data PR<br/>or Dependabot update"]

  subgraph ci["ci.yml, on every PR and push to main"]
    install["Install with<br/>frozen lockfile"]
    lint["biome ci"]
    types["pnpm typecheck"]
    unit["pnpm test, Vitest"]
    build["pnpm build"]
    e2e["pnpm test:e2e<br/>desktop and small-desktop"]
    traces["Upload Playwright traces<br/>if anything failed"]
    install --> lint --> types --> unit --> build --> e2e
    e2e -.->|"on failure"| traces
  end

  merge["Review and merge to main<br/>ci.yml runs again"]

  subgraph deploy["Manual deploy, GitHub is not connected to Vercel"]
    cli["pnpm dlx vercel deploy<br/>--prod --yes from a clean main"]
    vbuild["Vercel runs next build<br/>and reads data/"]
    live["Live alias<br/>mcgill-plan-your-degree.vercel.app"]
    check["Check the live stylesheet<br/>has the new tokens"]
    cli --> vbuild --> live --> check
  end

  change --> install
  e2e -->|"all green"| merge
  merge --> cli
```
