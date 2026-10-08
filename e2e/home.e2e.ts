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
  await expect(
    page.getByRole("heading", { level: 1, name: "Your McGill degree" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");
  await expectNoHorizontalScroll(page);
});

test("nav links reach their pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const [name, path] of [
    ["Browse courses", "/courses"],
    ["What's next", "/next"],
    ["Planner", "/plan"],
    ["Profile", "/profile"],
  ] as const) {
    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(nav.getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectNoHorizontalScroll(page);
  }
});

test("a returning student sees their home and can add a required course", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: "computer-science-major-bsc",
            plan: [],
            creditLimit: 17,
          },
          version: 2,
        }),
      ),
    [
      "plan-your-degree:profile",
      ["COMP 202", "COMP 206", "COMP 250"].map((code) => ({
        code,
        term: { season: "Fall", year: 2025 },
        credits: 3,
        grade: "A",
        status: "completed",
        source: "manual",
      })),
    ],
  );
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "Welcome back" }),
  ).toBeVisible();
  await expect(main.getByText("of 5 steps done")).toBeVisible();

  const nextUp = main.getByRole("region", { name: "Next up for Winter 2027" });
  await nextUp.getByRole("button", { name: /^Add / }).first().click();
  await expect(nextUp.getByRole("button", { name: /^Remove / })).toHaveCount(1);

  await main.getByRole("button", { name: "Dismiss setup guide" }).click();
  await page.reload();
  await expect(
    main.getByRole("button", { name: "Show setup guide" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});
