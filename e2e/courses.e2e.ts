import { expect, type Page, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

const seedProfile = (
  page: Page,
  records: unknown[],
  graduationTerm: unknown = null,
) =>
  page.addInitScript(
    ([key, records, graduationTerm]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: null,
            startTerm: null,
            graduationTerm,
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    ["plan-your-degree:profile", records, graduationTerm],
  );

// Course pages ask mcgill.courses for ratings, and tests never reach the real site.
test.beforeEach(({ page }) =>
  page.route("https://mcgill.courses/**", (route) => route.abort()),
);

test("search finds COMP 251 and its page links the prerequisites", async ({
  page,
}) => {
  await page.goto("/courses");
  const search = page.getByRole("searchbox");
  await expect(search).not.toBeFocused();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  for (const query of ["comp251", "COMP 251", "comp 251"]) {
    await search.fill(query);
    await expect(page.locator("tbody a").first()).toHaveAttribute(
      "href",
      "/courses/comp-251",
    );
  }
  await expect(page).toHaveURL(/q=comp\+251/);

  await page.locator("tbody a").first().click();
  await expect(page).toHaveTitle(/COMP 251 Algorithms and Data Structures/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Algorithms and Data Structures",
  );
  await expect(
    page.getByRole("main").getByRole("link", { name: "COMP 250" }),
  ).toHaveAttribute("href", "/courses/comp-250");
  await expect(
    page.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");

  await page.goto("/courses/comp-250");
  await expect(
    page
      .locator("section", {
        has: page.getByRole("heading", { name: "Unlocks" }),
      })
      .getByRole("link", { name: "COMP 251" }),
  ).toHaveAttribute("href", "/courses/comp-251");
});

test("a course page shows the mcgill.courses rating and links to the reviews", async ({
  page,
}) => {
  await page.route("https://mcgill.courses/api/courses/COMP251", (route) =>
    route.fulfill({
      json: {
        course: { avgRating: 3.07, avgDifficulty: 4.17, reviewCount: 2609 },
      },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/courses/comp-251");
  const ratings = page.getByRole("region", { name: "Student ratings" });
  await expect(ratings).toContainText("3.1");
  await expect(ratings).toContainText("4.2");
  await expect(
    ratings.getByRole("link", { name: "Read the 2,609 reviews" }),
  ).toHaveAttribute("href", "https://mcgill.courses/course/comp-251");
});

test("administrative and non-degree subjects stay off the list but keep their page", async ({
  page,
}) => {
  await page.goto("/courses?q=regn");
  await expect(page.getByText("No courses match")).toBeVisible();
  const response = await page.goto("/courses/fmt4-001");
  expect(response?.status()).toBe(200);
});

test("an unknown course is a 404", async ({ page }) => {
  const response = await page.goto("/courses/nope-999");
  expect(response?.status()).toBe(404);
});

test("with a profile, Can take now is the default tab and a course can be planned", async ({
  page,
}) => {
  await seedProfile(page, [done("COMP 250"), done("MATH 240")]);
  await page.goto("/courses?q=comp+25");
  await expect(page.getByRole("searchbox")).toHaveValue("comp 25");
  const rows = page.locator("tbody tr");
  await expect(rows.filter({ hasText: "COMP 251" })).toBeVisible();
  await expect(rows.filter({ hasText: "COMP 250" })).toHaveCount(0);

  await page.getByRole("tab", { name: /^All/ }).click();
  await expect(rows.filter({ hasText: "COMP 250" })).toBeVisible();
  await page.getByRole("tab", { name: /^Can take now/ }).click();

  await page.getByRole("button", { name: "Level" }).click();
  await page.getByRole("checkbox", { name: "200" }).click();
  await expect(page).toHaveURL(/level=200/);
  await page.keyboard.press("Escape");

  await rows.filter({ hasText: "COMP 251" }).click();
  await page.getByRole("button", { name: /^Add to / }).click();
  await expect(page.getByText(/^Planned for /)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your status" })).toContainText(
    "Planned",
  );
});

test("a course page adds the course to any term before graduation and moves it", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await seedProfile(page, [done("COMP 250"), done("MATH 240")], {
    season: "Winter",
    year: 2028,
  });
  await page.goto("/courses/comp-251");
  await expect(
    page.getByRole("button", { name: "Add to Winter 2027" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Choose a term" }).click();
  const items = page.getByRole("menu").getByRole("menuitem");
  await expect(items).toHaveCount(4);
  await expect(items.nth(1)).toContainText("Summer 2027");
  await expect(items.nth(1)).toContainText("Not offered");
  await items.filter({ hasText: "Fall 2027" }).click();
  await expect(page.getByText("Planned for Fall 2027")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Add to / })).toHaveCount(0);

  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: /^Fall 2027.*current term/ }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: /^Winter 2028/ }).click();
  await expect(page.getByText("Planned for Winter 2028")).toBeVisible();

  await page.getByRole("link", { name: "Planner" }).click();
  await page.getByRole("tab", { name: /^Winter 2028/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("COMP 251");
});

test("view tabs move with the arrow keys", async ({ page }) => {
  await seedProfile(page, [done("COMP 250")]);
  await page.goto("/courses");
  const tabs = page.getByRole("tab");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "0");
  await tabs.nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/view=program/);
  await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
  await expect(page).toHaveURL(/view=all/);
  await expect(page.getByRole("tabpanel")).toBeVisible();
});

test("a URL the page cannot honor is rewritten to what it shows", async ({
  page,
}) => {
  await page.goto("/courses?view=nope");
  await expect(page.getByRole("tab", { name: /^All/ })).toBeVisible();
  await expect(page).toHaveURL(/\/courses$/);

  await page.goto("/courses?sort=credits&page=999");
  await expect(page.getByRole("tab", { name: /^All/ })).toBeVisible();
  await expect(page).toHaveURL(/sort=credits&page=\d+$/);
  await expect(page).not.toHaveURL(/page=999/);
});

test("Back to the course list restores the scroll position", async ({
  page,
}) => {
  await page.goto("/courses");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem(`scroll:${history.state.scrollId}`),
      ),
    )
    .toBe("300");
  await rows.nth(12).click();
  await expect(page).toHaveURL(/\/courses\/.+/);
  await page.goBack();
  await expect(rows.first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);
});
