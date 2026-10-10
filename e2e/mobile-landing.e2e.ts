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

test("on a phone the landing stacks, fits the screen and its calls work by tap", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");
  const h1 = main.getByRole("heading", { level: 1 });
  await expect(h1).toHaveText("Plan your whole McGill degree in one tab");
  const lines = await h1.evaluate(
    (el) =>
      el.getBoundingClientRect().height /
      Number.parseFloat(getComputedStyle(el).lineHeight),
  );
  expect(Math.round(lines)).toBeLessThanOrEqual(4);
  await expectNoHorizontalScroll(page);

  const width = page.viewportSize()?.width ?? 0;
  const start = main.getByRole("button", {
    name: "Start without a transcript",
  });
  const box = await start.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThan(width - 40);
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveCount(2);
  await expect(
    main.getByRole("link", { name: /Open source on GitHub/ }).first(),
  ).toBeVisible();

  // The pinned story is gone on phones, so each heading is there once.
  for (const name of STORY) {
    await expect(main.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(
    main.getByRole("heading", { name: "Start mapping your degree" }),
  ).toBeVisible();

  await start.tap();
  await expect(page).toHaveURL(/\/profile#program$/);
});

test("on a phone a returning student gets the landing without the calls to start", async ({
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
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  for (const name of STORY) {
    await expect(main.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveCount(0);
  await expect(
    main.getByRole("button", { name: "Start without a transcript" }),
  ).toHaveCount(0);
  await expect(
    main.getByRole("heading", { name: "Start mapping your degree" }),
  ).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("on a phone the missing page fits and leads to the course list", async ({
  page,
}) => {
  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Browse courses" })
    .tap();
  await expect(page).toHaveURL("/courses");
});
