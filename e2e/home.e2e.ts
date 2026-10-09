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
    main.getByRole("heading", { level: 1, name: "Your McGill degree" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");
  await expectNoHorizontalScroll(page);

  await main
    .getByRole("button", { name: "Start without a transcript" })
    .click();
  await expect(
    main.getByRole("heading", { level: 1, name: "0 credits earned" }),
  ).toBeVisible();
  await expect(
    main.getByText("Import your transcript to fill in your courses."),
  ).toBeVisible();
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
    main.getByRole("heading", { level: 1, name: "9 credits earned" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Set graduation term" }),
  ).toHaveAttribute("href", "/profile#graduation");

  const required = main.getByRole("region", {
    name: "Required courses open in Winter 2027",
  });
  await required.getByRole("button", { name: /^Add / }).first().click();
  await expect(required.getByRole("button", { name: /^Remove / })).toHaveCount(
    1,
  );
  await expect(required.getByText("Planned", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
