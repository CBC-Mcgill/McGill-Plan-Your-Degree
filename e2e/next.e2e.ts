import { expect, type Page, test } from "@playwright/test";

const KEY = "plan-your-degree:profile";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

/** Opens What's next on 8 October 2026, so the next term is Winter 2027, with a saved profile. */
async function openWith(page: Page, state: Record<string, unknown>) {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    [KEY, JSON.stringify({ state: { creditLimit: 17, ...state }, version: 4 })],
  );
  await page.goto("/next");
}

const row = (page: Page, region: string, code: string) =>
  page
    .getByRole("region", { name: region })
    .getByRole("listitem")
    .filter({ hasText: code });

const requirement = (page: Page, name: string) =>
  page
    .getByRole("tablist", { name: "Requirements" })
    .getByRole("tab", { name });

test("without a profile it asks the student to import a transcript", async ({
  page,
}) => {
  await page.goto("/next");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "See what you can take next" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");
  await expect(
    main.getByRole("button", { name: "Start without a transcript" }),
  ).toBeVisible();
});

test("the old requirements page redirects here for good", async ({
  page,
  request,
}) => {
  const response = await request.get("/requirements", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/next");
  await page.goto("/requirements");
  await expect(page).toHaveURL("/next");
});

test("a required course can be added to the next term, and the planner opens the course after it in the term after", async ({
  page,
}) => {
  await openWith(page, {
    records: [done("COMP 202"), done("COMP 206"), done("COMP 250")],
    programId: "computer-science-major-bsc",
    plan: [],
  });
  await expect(page.getByRole("main")).toContainText(
    "What you can take in Winter 2027, your next term",
  );
  await expect(page.getByRole("tablist", { name: "Term" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Visual Schedule Builder/ }),
  ).toHaveAttribute("href", "https://vsb.mcgill.ca/criteria.jsp");
  await expect(row(page, "Required courses", "COMP 310")).toContainText(
    "Needs COMP 273 first",
  );

  await row(page, "Required courses", "COMP 273")
    .getByRole("button", { name: "Add COMP 273 to Winter 2027" })
    .click();
  const remove = page.getByRole("button", {
    name: "Remove COMP 273 from Winter 2027",
  });
  await expect(remove).toBeFocused();

  await page.getByRole("link", { name: "Plan later terms" }).click();
  await page.getByRole("tab", { name: /^Fall 2027/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Fill Fall 2027" })
      .getByRole("checkbox", { name: /COMP 310/ }),
  ).toBeAttached();

  await page.goBack();
  await remove.click();
  await expect(
    page.getByRole("button", { name: "Add COMP 273 to Winter 2027" }),
  ).toBeAttached();
});

test("each requirement shows the courses it counts", async ({ page }) => {
  await openWith(page, {
    records: [
      done("COMP 202"),
      done("COMP 206"),
      done("COMP 250"),
      done("MATH 240"),
      done("ANTH 202"),
    ],
    programId: "computer-science-major-bsc",
    plan: [{ term: { season: "Winter", year: 2027 }, courses: ["COMP 303"] }],
  });
  await expect(
    page.getByRole("heading", { level: 1, name: "Computer Science Major" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "12 of 63 program credits earned or in progress",
  );
  await expect(row(page, "Required courses", "COMP 303")).toContainText(
    "Winter 2027",
  );

  await expect(
    page
      .getByRole("region", { name: "Required courses" })
      .getByRole("heading", { name: "Counted 4" }),
  ).toBeVisible();
  await expect(
    row(page, "Required courses", "MATH 240").filter({ hasText: "Completed" }),
  ).toContainText("Fall 2025");

  await requirement(page, "Complementary courses").click();
  await page
    .getByRole("region", { name: "Complementary courses" })
    .getByRole("button", { name: /^Show \d+ more$/ })
    .first()
    .click();
  const fewer = page.getByRole("button", { name: "Show fewer" });
  await expect(fewer).toBeFocused();
  await expect(fewer).toHaveAttribute("aria-expanded", "true");

  await requirement(page, "Not counted").click();
  const notCounted = page.getByRole("region", {
    name: "Not counted toward your program",
  });
  await expect(notCounted).toContainText("1 course, 3 credits");
  const anth = notCounted.getByRole("listitem").filter({ hasText: "ANTH 202" });
  await expect(anth).toContainText("Completed");
  await expect(anth).toContainText("Fall 2025");
});

test("met and CEGEP-credited groups, the restriction note and the minor open from the list", async ({
  page,
}) => {
  await openWith(page, {
    records: [
      done("INTG 215"),
      done("MGPO 440"),
      done("MATH 240"),
      done("MATH 222"),
    ],
    programId: "computer-engineering-beng",
    minorId: "technological-entrepreneurship-minor-beng",
    entry: "cegep",
    plan: [],
  });

  await requirement(page, "Required year 0 courses").click();
  await expect(
    page.getByRole("region", { name: "Required year 0 courses" }),
  ).toContainText("Your Quebec CEGEP diploma credits this group");
  await requirement(page, "Complementary studies group A").click();
  await expect(
    row(page, "Complementary studies group A", "MGPO 440"),
  ).toContainText("Completed");

  await requirement(page, "Required non-departmental courses").click();
  await expect(
    row(page, "Required non-departmental courses", "MATH 262"),
  ).toContainText(
    "Not open to students who have taken MATH 222. Ask your advisor whether MATH 222 counts instead.",
  );

  await requirement(page, "Technological Entrepreneurship minor").click();
  const minor = page.getByRole("region", {
    name: "Technological Entrepreneurship minor",
  });
  await expect(minor).toContainText("Read automatically from the catalogue");
  await expect(
    minor.getByRole("listitem").filter({ hasText: "INTG 215" }),
  ).toContainText("Counts for both");
  await minor
    .getByRole("button", { name: "Technological Entrepreneurship minor" })
    .hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "up to a limit set by your faculty",
  );

  const width = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(width).toBeLessThanOrEqual(0);
});

test("a started profile with no program asks for one", async ({ page }) => {
  await openWith(page, {
    records: [],
    programId: null,
    startTerm: { season: "Fall", year: 2026 },
  });
  await expect(
    page.getByRole("link", { name: "Pick your program" }),
  ).toHaveAttribute("href", "/profile#program");
  await expect(
    page.getByRole("button", {
      name: "Other courses you can take in Winter 2027",
    }),
  ).toBeVisible();
});

test("a minor picked on the profile shows on What's next", async ({ page }) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key as string)) return;
    localStorage.setItem(
      key as string,
      JSON.stringify({
        state: {
          records: [],
          programId: "computer-engineering-beng",
          startTerm: { season: "Fall", year: 2026 },
        },
        version: 4,
      }),
    );
  }, KEY);
  await page.goto("/profile");

  const minorName = "Technological Entrepreneurship Minor";
  await page
    .getByRole("combobox", { name: "Program" })
    .fill("technological entrepreneurship");
  await expect(page.getByText("No program matches")).toBeVisible();

  const minor = page.getByRole("combobox", { name: "Minor" });
  await minor.fill("technological entrepreneurship");
  await minor.press("Enter");
  await expect(minor).toHaveValue(`${minorName} (B.Eng.)`);

  await page.goto("/next");
  await expect(
    requirement(page, "Technological Entrepreneurship minor"),
  ).toBeVisible();
});

test("the picked requirement lives in the URL, so Back and links reopen it", async ({
  page,
}) => {
  await openWith(page, {
    records: [done("COMP 202"), done("ANTH 202")],
    programId: "computer-science-major-bsc",
    plan: [],
  });
  await expect(requirement(page, "Required courses")).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await requirement(page, "Complementary courses").click();
  await expect(page).toHaveURL("/next?req=complementary-courses");
  await requirement(page, "Not counted").click();
  await expect(
    page.getByRole("region", { name: "Not counted toward your program" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("region", { name: "Complementary courses" }),
  ).toBeVisible();

  await requirement(page, "Complementary courses").press("ArrowUp");
  await expect(requirement(page, "Required courses")).toBeFocused();
  await expect(page).toHaveURL("/next?req=required-courses");

  await page.goto("/next?req=other");
  await expect(
    page.getByRole("region", {
      name: "Other courses you can take in Winter 2027",
    }),
  ).toBeVisible();
});
