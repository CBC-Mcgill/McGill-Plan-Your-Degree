import { expect, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

// Course pages ask mcgill.courses for ratings, and tests never reach the real site.
test.beforeEach(({ page }) =>
  page.route("https://mcgill.courses/**", (route) => route.abort()),
);

test("search finds COMP 251 and its page links the prerequisites", async ({
  page,
}) => {
  await page.goto("/courses");
  const search = page.getByRole("searchbox");
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

test("an unknown course is a 404", async ({ page }) => {
  const response = await page.goto("/courses/nope-999");
  expect(response?.status()).toBe(404);
});

test("with a profile, Can take now is the default tab and a course can be planned", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: null,
            startTerm: null,
            graduationTerm: null,
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    ["plan-your-degree:profile", [done("COMP 250"), done("MATH 240")]],
  );
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
