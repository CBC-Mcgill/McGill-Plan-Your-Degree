import { expect, type Page, test } from "@playwright/test";

const expectNoHorizontalScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

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
