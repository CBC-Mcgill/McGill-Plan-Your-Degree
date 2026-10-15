import { expect, type Locator, type Page, test } from "@playwright/test";

const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

const LINES = [
  "Import the transcript PDF from Minerva. Your courses and grades fill in, and the file never leaves your browser.",
  "What's next checks prerequisites for you and shows what you can take next term, what is locked and why.",
  "The Planner holds every term until graduation and warns you when a course is not offered or comes too early.",
];

/** Scrolls the pinned story that holds `heading` to `at`, from 0 where it sticks to 1 where it lets go. Step 1 holds over the first fifth, steps 2 and 3 take two fifths each. */
const scrollStory = (heading: Locator, at: number) =>
  heading.evaluate((h2, at) => {
    let pane = h2.parentElement;
    while (pane && getComputedStyle(pane).position !== "sticky") {
      pane = pane.parentElement;
    }
    const section = pane?.parentElement;
    if (!pane || !section) throw new Error("No pinned story");
    const style = getComputedStyle(section);
    const before = Number.parseFloat(style.paddingTop);
    const range =
      section.offsetHeight -
      before -
      Number.parseFloat(style.paddingBottom) -
      pane.offsetHeight;
    const start =
      section.getBoundingClientRect().top +
      scrollY +
      before -
      Number.parseFloat(getComputedStyle(pane).top);
    scrollTo({ top: start + range * at, behavior: "instant" });
  }, at);

/** How much each text shows in the pinned story: its opacity times its ancestors', and 0 while its box is clipped shut. */
const shown = (heading: Locator, texts: string[]) =>
  heading.evaluate((h2, texts) => {
    const section = h2.closest("section");
    const all = [...(section?.querySelectorAll("*") ?? [])];
    return texts.map((text) => {
      let element = all.findLast((each) => each.textContent === text) ?? null;
      if (!(element instanceof HTMLElement)) return 0;
      if (element.clientHeight < element.scrollHeight - 1) return 0;
      let opacity = 1;
      for (; element && element !== section; element = element.parentElement) {
        opacity *= Number(getComputedStyle(element).opacity);
      }
      return Math.round(opacity * 100) / 100;
    });
  }, texts);

test("the pinned story opens each step's line under its headline as it scrolls", async ({
  page,
}) => {
  await page.goto("/");
  const heading = page
    .getByRole("main")
    .getByRole("heading", { level: 2, name: "See what you can take next" });
  for (const [i, line] of LINES.entries()) {
    await scrollStory(heading, [0.1, 0.4, 0.8][i] ?? 0);
    await expect
      .poll(() => shown(heading, LINES))
      .toEqual(LINES.map((each) => (each === line ? 1 : 0)));
  }
  await expectNoHorizontalScroll(page);
});

test("the pinned story builds with the scroll, holds still when it stops and runs back", async ({
  page,
}) => {
  await page.goto("/");
  const heading = page
    .getByRole("main")
    .getByRole("heading", { level: 2, name: "See what you can take next" });
  const rows = [
    "Programming Languages and Paradigms",
    "Software Design",
    "Numerical Computing",
    "Database Systems",
  ];
  const parts = [...rows, "COMP 250", "Needs COMP 302 first"];
  const full = async () =>
    (await shown(heading, rows)).filter((opacity) => opacity === 1).length;

  // Step 1 builds on the way in, so it is whole when the pane sticks.
  await scrollStory(heading, 0);
  await expect
    .poll(async () => (await shown(heading, ["Probability"]))[0])
    .toBe(1);

  // A quarter into step 2.
  await scrollStory(heading, 0.3);
  await expect.poll(async () => (await shown(heading, parts))[0]).toBe(1);
  expect((await shown(heading, parts)).at(-1)).toBe(0);
  const built = await shown(heading, parts);
  const count = await full();

  // Nothing is timed, so a second later the card is as the scroll left it.
  await page.waitForTimeout(1000);
  expect(await shown(heading, parts)).toEqual(built);

  await page.mouse.wheel(0, -100);
  await expect.poll(full).toBeLessThan(count);
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
