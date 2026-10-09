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
  plan: unknown[] = [],
) =>
  page.addInitScript(
    ([key, records, graduationTerm, plan]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: null,
            startTerm: null,
            graduationTerm,
            plan,
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    ["plan-your-degree:profile", records, graduationTerm, plan],
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
  await expect(page.getByText("3.1 of 5")).toBeVisible();
  await expect(page.getByText("4.2 of 5")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "2,609 reviews on mcgill.courses" }),
  ).toHaveAttribute("href", "https://mcgill.courses/course/comp-251");
});

test("a course page checks each prerequisite and says which One of is met", async ({
  page,
}) => {
  await seedProfile(page, [done("COMP 202"), done("COMP 302")]);
  await page.goto("/courses/ecse-458");
  await expect(page.getByText("Needs 3 more prerequisites")).toBeVisible();
  const prerequisites = page.getByRole("region", { name: "Prerequisites" });
  await expect(prerequisites).toContainText("1 of 4 met");
  await expect(
    prerequisites.getByRole("listitem").filter({ hasText: "ECSE 324" }),
  ).toContainText("Locked");
  await expect(prerequisites).toContainText("Met by COMP 302");
  await expect(
    // The last match is the row inside its One of group.
    prerequisites.getByRole("listitem").filter({ hasText: "CCOM 206" }).last(),
  ).toContainText("Not in this year's catalogue");
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

  await page.getByRole("tab", { name: "All" }).click();
  await expect(rows.filter({ hasText: "COMP 250" })).toBeVisible();
  await page.getByRole("tab", { name: "Can take now" }).click();

  await page.getByRole("button", { name: "Level" }).click();
  await page.getByRole("checkbox", { name: "200" }).click();
  await expect(page).toHaveURL(/level=200/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear Level" }).click();
  await expect(page).not.toHaveURL(/level=200/);

  await rows.filter({ hasText: "COMP 251" }).click();
  await expect(
    page.getByRole("button", { name: "About Can take" }),
  ).toBeVisible();
  const add = page.getByRole("button", { name: /^Add to / });
  const name = await add.textContent();
  await add.click();
  await expect(page.getByText(/^Planned for /)).toBeVisible();
  const planned = page.getByRole("button", { name: "Change term" });
  await expect(planned).toBeFocused();
  await planned.click();
  await expect(page.getByRole("menuitem").last()).toHaveText(
    "Remove from plan",
  );
  await page.getByRole("menuitem", { name: "Remove from plan" }).click();
  await expect(page.getByRole("button", { name: name ?? "" })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(planned).toBeVisible();
});

test("a course not offered this year never reads Can take", async ({
  page,
}) => {
  await seedProfile(page, [done("COMP 250")]);
  await page.goto("/courses/comp-280");
  await expect(page.getByText("Not offered in 2026-2027")).toHaveCount(1);
  await expect(page.getByText("Can take")).toHaveCount(0);
  await page.getByRole("button", { name: "Add to a term" }).click();
  await expect(page.getByRole("menu")).toContainText(
    "Not offered in 2026-2027",
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

  await page.getByRole("button", { name: "Change term" }).click();
  await expect(
    page.getByRole("menuitem", { name: /^Fall 2027.*planned here/ }),
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
  await expect(tabs).toHaveText(["Can take now", "All"]);
  await expect(tabs.first()).toHaveAttribute("tabindex", "0");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/view=all/);
  await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
  await expect(page).not.toHaveURL(/view=/);
  await expect(page.getByRole("tabpanel")).toBeVisible();
});

test("a URL the page cannot honor is rewritten to what it shows", async ({
  page,
}) => {
  await page.goto("/courses?view=nope&sort=code&page=999");
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page).toHaveURL(/\/courses\?page=\d+$/);
  await expect(page).not.toHaveURL(/page=999/);

  await seedProfile(page, [done("COMP 250")]);
  for (const view of ["planned", "completed"]) {
    await page.goto(`/courses?view=${view}`);
    await expect(
      page.getByRole("tab", { name: "Can take now" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/\/courses$/);
  }
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

test("a column's info icon shows its definition on click and hides it on the next", async ({
  page,
}) => {
  await page.goto("/courses");
  const info = page.getByRole("button", { name: "About Credits" });
  await info.click();
  await expect(page.getByRole("tooltip")).toContainText(
    "Credits you earn by passing the course.",
  );
  await info.click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("the header stays in view while the course list scrolls", async ({
  page,
}) => {
  await page.goto("/courses");
  await expect(page.locator("tbody a").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(500);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeInViewport();
});
