import { expect, type Page, test } from "@playwright/test";

const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

const STORY = [
  "Start from your transcript",
  "See what you can take next",
  "Plan every term to graduation",
];

const LINES = [
  "Import the transcript PDF from Minerva. Your courses and grades fill in, and the file never leaves your browser.",
  "What's next checks prerequisites for you and shows what you can take next term, what is locked and why.",
  "The Planner holds every term until graduation and warns you when a course is not offered or comes too early.",
];

/** Scrolls to a point of the pinned story: 0 where the pane sticks, 1 where it lets go. */
const scrollStory = async (page: Page, at: number) => {
  const y = await page
    .getByRole("heading", { level: 2, name: STORY[0] })
    .evaluate((heading, at) => {
      const section = heading.closest("section") as HTMLElement;
      const pane = section.firstElementChild as HTMLElement;
      const style = getComputedStyle(section);
      const before = Number.parseFloat(style.paddingTop);
      const after = Number.parseFloat(style.paddingBottom);
      const top = Number.parseFloat(getComputedStyle(pane).top);
      const start =
        section.getBoundingClientRect().top + window.scrollY + before - top;
      const range = section.offsetHeight - before - after - pane.offsetHeight;
      return Math.round(start + range * at);
    }, at);
  await page.evaluate((y) => window.scrollTo(0, y), y);
};

/** Each step's visual opacity, and how built the transcript's last row is. */
const storyState = (page: Page) =>
  page
    .getByRole("heading", { level: 2, name: STORY[0] })
    .evaluate((heading) => {
      const pane = heading.closest("section")?.firstElementChild as HTMLElement;
      const visuals = [
        ...(pane.querySelector(":scope > div > [aria-hidden]")?.children ?? []),
      ];
      const opacity = (el: Element) => Number(getComputedStyle(el).opacity);
      const last = [...(visuals[0]?.querySelectorAll("span") ?? [])].find(
        (span) => span.textContent === "Probability",
      );
      let built = 1;
      for (
        let el = last ?? null;
        el && el !== visuals[0];
        el = el.parentElement
      )
        built *= opacity(el);
      return { visuals: visuals.map(opacity), built: last ? built : 0 };
    });

test("landing renders its primary action", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", {
      level: 1,
      name: "Plan your whole McGill degree in one tab",
    }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Import your transcript" }).first(),
  ).toHaveAttribute("href", "/profile");
  await expectNoHorizontalScroll(page);

  await main
    .getByRole("button", { name: "Start without a transcript" })
    .click();
  await expect(page).toHaveURL(/\/profile#program$/);
});

test("nav links reach their pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText([
    "Browse courses",
    "What's next",
    "Planner",
    "Advisor Soon",
    "Profile",
  ]);
  for (const [name, path] of [
    ["Browse courses", "/courses"],
    ["What's next", "/next"],
    ["Planner", "/plan"],
    ["Advisor", "/advisor"],
    ["Profile", "/profile"],
  ] as const) {
    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL(path);
    await expect(nav.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalScroll(page);
  }
});

test("a returning student keeps the landing without the calls to start", async ({
  page,
}) => {
  await page.addInitScript(
    ([key]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records: [],
            programId: "computer-science-major-bsc",
            plan: [],
          },
          version: 4,
        }),
      ),
    ["plan-your-degree:profile"],
  );
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1 })).toContainText(
    "Plan your whole McGill degree",
  );
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveCount(0);
  await expect(
    main.getByRole("button", { name: "Start without a transcript" }),
  ).toHaveCount(0);
});

test("the pinned story opens each step's line as the scroll reaches it", async ({
  page,
}) => {
  await page.goto("/");
  const lines = LINES.map((line) =>
    page.getByText(line).filter({ visible: true }),
  );
  for (const [i, line] of lines.entries()) {
    await scrollStory(page, (i + 0.5) / STORY.length);
    await expect(line).toBeInViewport({ ratio: 1 });
    for (const other of lines.filter((_, k) => k !== i)) {
      await expect(other).not.toBeInViewport();
    }
  }
  await expectNoHorizontalScroll(page);
});

test("the story hands a step over as fast as the scroll and never rebuilds one", async ({
  page,
}) => {
  await page.goto("/");
  await scrollStory(page, 0.5 / STORY.length);
  await expect.poll(async () => (await storyState(page)).built).toBe(1);

  // Halfway through the hand-off, both visuals hold half shown.
  await scrollStory(page, 1 / STORY.length);
  await page.waitForTimeout(1000);
  const [transcript, next] = (await storyState(page)).visuals;
  for (const opacity of [transcript, next]) {
    expect(opacity).toBeGreaterThan(0.3);
    expect(opacity).toBeLessThan(0.7);
  }

  await scrollStory(page, 0.5 / STORY.length);
  await page.waitForTimeout(100);
  expect((await storyState(page)).built).toBe(1);
});
